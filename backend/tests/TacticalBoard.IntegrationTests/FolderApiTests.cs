using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Application;
using TacticalBoard.Folders.Contracts;
using TacticalBoard.Folders.Domain;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.IntegrationTests.TestSupport;
using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.IntegrationTests;

/// <summary>Folders and situations in folders (arc42 ch. 8.15) through the real pipeline and PostgreSQL.</summary>
public sealed class FolderApiTests(PostgresFixture postgres) : IAsyncLifetime
{
    private const string PersonalFolders = "/api/personal-area/folders";
    private const string PersonalSituations = "/api/personal-area/situations";

    /// <summary>How long a request must stay blocked by a held lock to count as waiting for it.</summary>
    private static readonly TimeSpan BlockedFor = TimeSpan.FromMilliseconds(500);

    private readonly string _connectionString = postgres.NewDatabaseConnectionString();
    private ApiFactory _factory = null!;

    public ValueTask InitializeAsync()
    {
        _factory = ApiFactory.WithDatabase(_connectionString);
        return ValueTask.CompletedTask;
    }

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private async Task<TestBrowser> LoggedInAsync(string subject, string name)
    {
        var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync(subject, TestClaims.Profile(name));
        return browser;
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Cancellation);

    private static async Task<string> CreateFolderAsync(TestBrowser browser, string name)
    {
        using var response = await browser.SendJsonAsync(HttpMethod.Post, PersonalFolders, new { name }, await browser.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await JsonAsync(response)).GetProperty("id").GetString()!;
    }

    private static async Task<JsonElement> CreateSituationAsync(TestBrowser browser, string path, string title, string? origin = null)
    {
        using var response = await browser.SendJsonAsync(HttpMethod.Post, path, new { document = SituationJson.Document(title), origin }, await browser.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await JsonAsync(response);
    }

    private static async Task<HttpResponseMessage> MoveAsync(TestBrowser browser, string situationId, string? folderId) =>
        await browser.SendJsonAsync(HttpMethod.Put, $"/api/situations/{situationId}/folder", new { folderId }, await browser.AntiforgeryTokenAsync());

    private static async Task<List<string>> TitlesAsync(TestBrowser browser, string path)
    {
        using var response = await browser.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await JsonAsync(response)).EnumerateArray().Select(item => item.GetProperty("title").GetString()!).ToList();
    }

    private static async Task<JsonElement> AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await JsonAsync(response);
        Assert.Equal("https://tacticalboard/errors/" + code, problem.GetProperty("type").GetString());
        return problem;
    }

    [Fact]
    public async Task Creates_lists_renames_and_deletes_folders()
    {
        using var alice = await LoggedInAsync("alice", "Alice");

        using var created = await alice.SendJsonAsync(HttpMethod.Post, PersonalFolders, new { name = "  Set pieces " }, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await JsonAsync(created);
        var id = body.GetProperty("id").GetString()!;
        Assert.Equal(new Uri($"http://localhost/api/folders/{id}"), created.Headers.Location);
        Assert.Equal("Set pieces", body.GetProperty("name").GetString());
        await CreateFolderAsync(alice, "breakouts");

        using var list = await alice.GetAsync(PersonalFolders);
        Assert.Equal(["breakouts", "Set pieces"], (await JsonAsync(list)).EnumerateArray().Select(folder => folder.GetProperty("name").GetString()));

        using var renamed = await alice.SendJsonAsync(HttpMethod.Put, $"/api/folders/{id}", new { name = "Power plays" }, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        using var get = await alice.GetAsync($"/api/folders/{id}");
        Assert.Equal("Power plays", (await JsonAsync(get)).GetProperty("name").GetString());

        using var deleted = await alice.SendJsonAsync(HttpMethod.Delete, $"/api/folders/{id}", null, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        using var afterDelete = await alice.GetAsync($"/api/folders/{id}");
        await AssertProblemAsync(afterDelete, HttpStatusCode.NotFound, "folder-not-found");
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM folders WHERE deleted_at IS NOT NULL"));
    }

    [Fact]
    public async Task Folder_names_are_unique_per_area_ignoring_case_and_free_again_after_deletion()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var id = await CreateFolderAsync(alice, "Set pieces");
        var other = await CreateFolderAsync(alice, "Breakouts");

        using var duplicate = await alice.SendJsonAsync(HttpMethod.Post, PersonalFolders, new { name = " SET PIECES" }, await alice.AntiforgeryTokenAsync());
        var problem = await AssertProblemAsync(duplicate, HttpStatusCode.Conflict, "duplicate-folder-name");
        Assert.Equal("SET PIECES", problem.GetProperty("existingName").GetString());
        using var renameToTaken = await alice.SendJsonAsync(HttpMethod.Put, $"/api/folders/{other}", new { name = "set pieces" }, await alice.AntiforgeryTokenAsync());
        await AssertProblemAsync(renameToTaken, HttpStatusCode.Conflict, "duplicate-folder-name");
        using var ownName = await alice.SendJsonAsync(HttpMethod.Put, $"/api/folders/{id}", new { name = "SET PIECES" }, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.OK, ownName.StatusCode);

        using var bob = await LoggedInAsync("bob", "Bob");
        await CreateFolderAsync(bob, "Set pieces");

        using var deleted = await alice.SendJsonAsync(HttpMethod.Delete, $"/api/folders/{id}", null, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        await CreateFolderAsync(alice, "Set pieces");
    }

    [Fact]
    public async Task An_invalid_name_is_a_validation_problem()
    {
        using var alice = await LoggedInAsync("alice", "Alice");

        using var blank = await alice.SendJsonAsync(HttpMethod.Post, PersonalFolders, new { name = "  " }, await alice.AntiforgeryTokenAsync());
        using var tooLong = await alice.SendJsonAsync(HttpMethod.Post, PersonalFolders, new { name = new string('a', FolderName.MaxLength + 1) }, await alice.AntiforgeryTokenAsync());

        var problem = await AssertProblemAsync(blank, HttpStatusCode.BadRequest, "validation-failed");
        var errors = problem.GetProperty("errors");
        Assert.Equal("must not be empty", errors.GetProperty("name")[0].GetString());
        var codes = problem.GetProperty("fieldErrors");
        Assert.Equal("required", codes.GetProperty("name")[0].GetProperty("code").GetString());
        Assert.Equal(
            "expected at most 64 characters",
            (await AssertProblemAsync(tooLong, HttpStatusCode.BadRequest, "validation-failed")).GetProperty("errors").GetProperty("name")[0].GetString());
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM folders"));
    }

    [Fact]
    public async Task Saves_lists_and_moves_situations_in_folders()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var folder = await CreateFolderAsync(alice, "Set pieces");
        var other = await CreateFolderAsync(alice, "Breakouts");
        var top = await CreateSituationAsync(alice, PersonalSituations, "Top");

        var inside = await CreateSituationAsync(alice, $"/api/folders/{folder}/situations", "Inside");
        Assert.Equal(folder, inside.GetProperty("folderId").GetString());
        using var opened = await alice.GetAsync($"/api/situations/{inside.GetProperty("id").GetString()}");
        Assert.Equal(folder, (await JsonAsync(opened)).GetProperty("folderId").GetString());

        Assert.Equal(["Top"], await TitlesAsync(alice, PersonalSituations));
        Assert.Equal(["Inside"], await TitlesAsync(alice, $"/api/folders/{folder}/situations"));
        Assert.Empty(await TitlesAsync(alice, $"/api/folders/{other}/situations"));

        var topId = top.GetProperty("id").GetString()!;
        using var moved = await MoveAsync(alice, topId, other);
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        var movedBody = await JsonAsync(moved);
        Assert.Equal(other, movedBody.GetProperty("folderId").GetString());
        Assert.Equal(1, movedBody.GetProperty("revision").GetInt32());
        Assert.Equal(top.GetProperty("updatedAt").GetDateTimeOffset(), movedBody.GetProperty("updatedAt").GetDateTimeOffset());
        Assert.False(movedBody.TryGetProperty("document", out _));
        Assert.Empty(await TitlesAsync(alice, PersonalSituations));
        Assert.Equal(["Top"], await TitlesAsync(alice, $"/api/folders/{other}/situations"));

        // A move is no revision: the ETag stays and a save based on it still works.
        using var afterMove = await alice.GetAsync($"/api/situations/{topId}");
        Assert.Equal("\"1\"", afterMove.Headers.ETag?.ToString());
        using var saved = await alice.SendJsonAsync(
            HttpMethod.Put,
            $"/api/situations/{topId}",
            new { document = SituationJson.Document("Top") },
            await alice.AntiforgeryTokenAsync(),
            new Dictionary<string, string> { ["If-Match"] = "\"1\"" });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(other, (await JsonAsync(saved)).GetProperty("folderId").GetString());
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM situation_revisions WHERE situation_id = '" + topId + "'"));

        using var back = await MoveAsync(alice, topId, null);
        Assert.Equal(JsonValueKind.Null, (await JsonAsync(back)).GetProperty("folderId").ValueKind);
        Assert.Equal(["Top"], await TitlesAsync(alice, PersonalSituations));
    }

    [Fact]
    public async Task Lists_folders_with_the_number_of_their_non_deleted_situations()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var full = await CreateFolderAsync(alice, "Full");
        await CreateFolderAsync(alice, "Empty");
        await CreateSituationAsync(alice, $"/api/folders/{full}/situations", "One");
        await CreateSituationAsync(alice, $"/api/folders/{full}/situations", "Two");
        var deleted = await CreateSituationAsync(alice, $"/api/folders/{full}/situations", "Deleted");
        using var deletion = await alice.SendJsonAsync(HttpMethod.Delete, $"/api/situations/{deleted.GetProperty("id").GetString()}", null, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.NoContent, deletion.StatusCode);
        var moved = await CreateSituationAsync(alice, PersonalSituations, "Moved in");
        using var move = await MoveAsync(alice, moved.GetProperty("id").GetString()!, full);
        Assert.Equal(HttpStatusCode.OK, move.StatusCode);
        await CreateSituationAsync(alice, PersonalSituations, "Top level");
        using var bob = await LoggedInAsync("bob", "Bob");
        var bobs = await CreateFolderAsync(bob, "Full");
        await CreateSituationAsync(bob, $"/api/folders/{bobs}/situations", "Bob's");

        using var list = await alice.GetAsync(PersonalFolders);

        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal(
            [("Empty", 0), ("Full", 3)],
            (await JsonAsync(list)).EnumerateArray().Select(folder => (folder.GetProperty("name").GetString(), folder.GetProperty("situationCount").GetInt32())));
    }

    [Fact]
    public async Task Titles_are_unique_across_the_folders_of_the_area()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var folder = await CreateFolderAsync(alice, "Set pieces");
        await CreateSituationAsync(alice, PersonalSituations, "Powerplay");

        using var duplicate = await alice.SendJsonAsync(
            HttpMethod.Post, $"/api/folders/{folder}/situations", new { document = SituationJson.Document("powerplay") }, await alice.AntiforgeryTokenAsync());
        await AssertProblemAsync(duplicate, HttpStatusCode.Conflict, "duplicate-title");

        var imported = await CreateSituationAsync(alice, $"/api/folders/{folder}/situations", "Powerplay", origin: "imported");
        Assert.Equal("Powerplay (2)", imported.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Parallel_first_saves_in_a_folder_with_the_default_title_get_different_numbers()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var folder = await CreateFolderAsync(alice, "Set pieces");
        var token = await alice.AntiforgeryTokenAsync();

        var saves = Enumerable.Range(1, 3).Select(async _ =>
        {
            using var response = await alice.SendJsonAsync(HttpMethod.Post, $"/api/folders/{folder}/situations", new { document = SituationJson.Document("") }, token);
            return response.StatusCode;
        });
        var statuses = await Task.WhenAll(saves);

        Assert.All(statuses, status => Assert.Equal(HttpStatusCode.Created, status));
        Assert.Equal(
            ["Untitled Situation", "Untitled Situation (2)", "Untitled Situation (3)"],
            (await TitlesAsync(alice, $"/api/folders/{folder}/situations")).Order());
    }

    [Fact]
    public async Task A_folder_with_situations_cant_be_deleted_until_it_is_empty()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var folder = await CreateFolderAsync(alice, "Set pieces");
        var inside = (await CreateSituationAsync(alice, $"/api/folders/{folder}/situations", "Inside")).GetProperty("id").GetString()!;
        var deletedInside = (await CreateSituationAsync(alice, $"/api/folders/{folder}/situations", "Gone")).GetProperty("id").GetString()!;
        using var deleteSituation = await alice.SendJsonAsync(HttpMethod.Delete, $"/api/situations/{deletedInside}", null, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.NoContent, deleteSituation.StatusCode);

        using var refused = await alice.SendJsonAsync(HttpMethod.Delete, $"/api/folders/{folder}", null, await alice.AntiforgeryTokenAsync());
        var problem = await AssertProblemAsync(refused, HttpStatusCode.Conflict, "folder-not-empty");
        Assert.Contains("Set pieces", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);

        using var moved = await MoveAsync(alice, inside, null);
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        using var deleted = await alice.SendJsonAsync(HttpMethod.Delete, $"/api/folders/{folder}", null, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        using var listDeleted = await alice.GetAsync($"/api/folders/{folder}/situations");
        await AssertProblemAsync(listDeleted, HttpStatusCode.NotFound, "folder-not-found");
        using var moveIntoDeleted = await MoveAsync(alice, inside, folder);
        await AssertProblemAsync(moveIntoDeleted, HttpStatusCode.NotFound, "folder-not-found");
        using var saveIntoDeleted = await alice.SendJsonAsync(
            HttpMethod.Post, $"/api/folders/{folder}/situations", new { document = SituationJson.Document("Late") }, await alice.AntiforgeryTokenAsync());
        await AssertProblemAsync(saveIntoDeleted, HttpStatusCode.NotFound, "folder-not-found");
    }

    [Fact]
    public async Task Another_users_folders_are_not_found_and_situations_dont_move_across_areas()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var folder = await CreateFolderAsync(alice, "Set pieces");
        var alicesSituation = (await CreateSituationAsync(alice, PersonalSituations, "Alice's")).GetProperty("id").GetString()!;
        using var bob = await LoggedInAsync("bob", "Bob");
        var bobsSituation = (await CreateSituationAsync(bob, PersonalSituations, "Bob's")).GetProperty("id").GetString()!;
        var bobsFolder = await CreateFolderAsync(bob, "Bob's folder");

        using var get = await bob.GetAsync($"/api/folders/{folder}");
        using var rename = await bob.SendJsonAsync(HttpMethod.Put, $"/api/folders/{folder}", new { name = "Mine" }, await bob.AntiforgeryTokenAsync());
        using var delete = await bob.SendJsonAsync(HttpMethod.Delete, $"/api/folders/{folder}", null, await bob.AntiforgeryTokenAsync());
        using var list = await bob.GetAsync($"/api/folders/{folder}/situations");
        using var save = await bob.SendJsonAsync(
            HttpMethod.Post, $"/api/folders/{folder}/situations", new { document = SituationJson.Document("Sneaky") }, await bob.AntiforgeryTokenAsync());
        using var moveIntoAlices = await MoveAsync(bob, bobsSituation, folder);
        using var moveAlices = await MoveAsync(bob, alicesSituation, bobsFolder);

        await AssertProblemAsync(get, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(rename, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(delete, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(list, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(save, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(moveIntoAlices, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(moveAlices, HttpStatusCode.NotFound, "situation-not-found");
        Assert.Equal(["Bob's folder"], (await JsonAsync(await bob.GetAsync(PersonalFolders))).EnumerateArray().Select(item => item.GetProperty("name").GetString()));
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM situations WHERE folder_id IS NOT NULL"));
    }

    [Fact]
    public async Task Everything_needs_a_session_and_changes_an_antiforgery_token()
    {
        using var anonymous = _factory.CreateBrowser();
        using var list = await anonymous.GetAsync(PersonalFolders);
        using var inFolder = await anonymous.GetAsync($"/api/folders/{Guid.NewGuid()}/situations");
        Assert.Equal(HttpStatusCode.Unauthorized, list.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, inFolder.StatusCode);

        using var alice = await LoggedInAsync("alice", "Alice");
        var situation = (await CreateSituationAsync(alice, PersonalSituations, "Top")).GetProperty("id").GetString()!;
        using var create = await alice.SendJsonAsync(HttpMethod.Post, PersonalFolders, new { name = "Set pieces" }, antiforgeryToken: null);
        using var move = await alice.SendJsonAsync(HttpMethod.Put, $"/api/situations/{situation}/folder", new { folderId = (string?)null }, antiforgeryToken: null);

        await AssertProblemAsync(create, HttpStatusCode.BadRequest, "invalid-antiforgery-token");
        await AssertProblemAsync(move, HttpStatusCode.BadRequest, "invalid-antiforgery-token");
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM folders"));
    }

    [Fact]
    public async Task A_move_into_a_folder_holds_off_its_deletion_which_then_finds_it_not_empty()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var folder = Guid.Parse(await CreateFolderAsync(alice, "Set pieces"));
        var situation = Guid.Parse((await CreateSituationAsync(alice, PersonalSituations, "Top")).GetProperty("id").GetString()!);
        var token = await alice.AntiforgeryTokenAsync();

        // A move in progress: the folder is locked for placing, the situation moved, not committed yet.
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>();
        await using (var transaction = await context.Database.BeginTransactionAsync(Cancellation))
        {
            Assert.NotNull(await scope.ServiceProvider.GetRequiredService<IFolderDirectory>().FindForPlacingAsync(folder, Cancellation));
            await context.Database.ExecuteSqlAsync($"UPDATE situations SET folder_id = {folder} WHERE id = {situation}", Cancellation);

            var deletion = alice.SendJsonAsync(HttpMethod.Delete, $"/api/folders/{folder}", null, token);
            await Task.Delay(BlockedFor, Cancellation);
            Assert.False(deletion.IsCompleted, "The deletion must wait for the move.");

            await transaction.CommitAsync(Cancellation);
            using var response = await deletion;
            await AssertProblemAsync(response, HttpStatusCode.Conflict, "folder-not-empty");
        }

        Assert.Equal(0, await CountAsync("SELECT count(*) FROM folders WHERE deleted_at IS NOT NULL"));
    }

    [Fact]
    public async Task A_deletion_in_progress_holds_off_a_move_into_the_folder_which_then_finds_no_folder()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var folder = Guid.Parse(await CreateFolderAsync(alice, "Set pieces"));
        var situation = (await CreateSituationAsync(alice, PersonalSituations, "Top")).GetProperty("id").GetString()!;
        var token = await alice.AntiforgeryTokenAsync();

        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>();
        var repository = scope.ServiceProvider.GetRequiredService<IFolderRepository>();
        await using (var transaction = await context.Database.BeginTransactionAsync(Cancellation))
        {
            var locked = await repository.LockForDeletionAsync(folder, Cancellation);
            Assert.NotNull(locked);
            locked.MarkDeleted(DateTimeOffset.UtcNow);
            await repository.SaveChangesAsync(Cancellation);

            var move = alice.SendJsonAsync(HttpMethod.Put, $"/api/situations/{situation}/folder", new { folderId = folder }, token);
            var save = alice.SendJsonAsync(HttpMethod.Post, $"/api/folders/{folder}/situations", new { document = SituationJson.Document("Late") }, token);
            await Task.Delay(BlockedFor, Cancellation);
            Assert.False(move.IsCompleted, "The move must wait for the deletion.");
            Assert.False(save.IsCompleted, "The first save must wait for the deletion.");

            await transaction.CommitAsync(Cancellation);
            using var moved = await move;
            using var saved = await save;
            await AssertProblemAsync(moved, HttpStatusCode.NotFound, "folder-not-found");
            await AssertProblemAsync(saved, HttpStatusCode.NotFound, "folder-not-found");
        }

        Assert.Equal(0, await CountAsync("SELECT count(*) FROM situations WHERE folder_id IS NOT NULL"));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM situations"));
    }

    [Fact]
    public async Task A_failed_save_inside_a_unit_of_work_rolls_back_only_to_its_savepoint()
    {
        var area = AreaReference.Personal(Guid.CreateVersion7());
        var now = DateTimeOffset.UtcNow;
        await using (var setup = _factory.Services.CreateAsyncScope())
        {
            await setup.ServiceProvider.GetRequiredService<IFolderRepository>().AddAsync(Folder.Create(Guid.CreateVersion7(), area, Name("Taken"), now, area.OwnerId), Cancellation);
        }

        await using var scope = _factory.Services.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IFolderRepository>();
        var transactions = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        await transactions.InTransactionAsync(
            async cancellation =>
            {
                await Assert.ThrowsAsync<FolderNameUniquenessViolationException>(() =>
                    repository.AddAsync(Folder.Create(Guid.CreateVersion7(), area, Name("taken"), now, area.OwnerId), cancellation));
                await repository.AddAsync(Folder.Create(Guid.CreateVersion7(), area, Name("Free"), now, area.OwnerId), cancellation);
                return true;
            },
            Cancellation);

        Assert.Equal(2, await CountAsync("SELECT count(*) FROM folders"));
    }

    [Fact]
    public async Task A_unit_of_work_rolls_back_when_the_work_fails()
    {
        var area = AreaReference.Personal(Guid.CreateVersion7());
        await using var scope = _factory.Services.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<IFolderRepository>();
        var transactions = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        await Assert.ThrowsAsync<InvalidOperationException>(() => transactions.InTransactionAsync<bool>(
            async cancellation =>
            {
                await repository.AddAsync(Folder.Create(Guid.CreateVersion7(), area, Name("Rolled back"), DateTimeOffset.UtcNow, area.OwnerId), cancellation);
                var nested = await transactions.InTransactionAsync(_ => Task.FromResult(42), cancellation);
                Assert.Equal(42, nested);
                throw new InvalidOperationException("Failed after the save.");
            },
            Cancellation));

        Assert.Equal(0, await CountAsync("SELECT count(*) FROM folders"));
    }

    [Fact]
    public async Task Stores_folders_with_their_metadata_columns_and_indexes()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var id = await CreateFolderAsync(alice, "  Übergang ");

        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(Cancellation);
        await using var command = new NpgsqlCommand(
            """
            SELECT f.name, f.normalized_name, f.area_kind, f.area_id = u.id, f.created_by = u.id,
                   (SELECT count(*) FROM pg_indexes WHERE indexname IN ('ix_folders_area_name', 'ix_situations_folder'))
            FROM folders f, users u WHERE f.id = @id AND u.subject = 'alice'
            """,
            connection);
        command.Parameters.AddWithValue("id", Guid.Parse(id));
        await using var reader = await command.ExecuteReaderAsync(Cancellation);
        Assert.True(await reader.ReadAsync(Cancellation));

        Assert.Equal(("Übergang", "ÜBERGANG", "Personal"), (reader.GetString(0), reader.GetString(1), reader.GetString(2)));
        Assert.True(reader.GetBoolean(3));
        Assert.True(reader.GetBoolean(4));
        Assert.Equal(2, reader.GetInt64(5));
    }

    [Fact]
    public async Task The_name_column_holds_the_longest_valid_name()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        await CreateFolderAsync(alice, new string('a', FolderName.MaxLength));

        Assert.Equal(
            FolderName.MaxLength,
            await CountAsync("SELECT character_maximum_length FROM information_schema.columns WHERE table_name = 'folders' AND column_name = 'name'"));
    }

    private static FolderName Name(string text)
    {
        Assert.True(FolderName.TryCreate(text, out var name, out _));
        return name;
    }

    private async Task<int> CountAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(Cancellation);
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync(Cancellation), System.Globalization.CultureInfo.InvariantCulture);
    }
}
