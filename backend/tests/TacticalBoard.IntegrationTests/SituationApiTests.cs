using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Npgsql;
using TacticalBoard.IntegrationTests.TestSupport;

namespace TacticalBoard.IntegrationTests;

/// <summary>Saved situations (arc42 ch. 8.15) through the real pipeline and PostgreSQL.</summary>
public sealed class SituationApiTests(PostgresFixture postgres) : IAsyncLifetime
{
    private const string PersonalArea = "/api/personal-area/situations";

    private readonly string _connectionString = postgres.NewDatabaseConnectionString();
    private ApiFactory _factory = null!;

    public ValueTask InitializeAsync()
    {
        _factory = ApiFactory.WithDatabase(_connectionString);
        return ValueTask.CompletedTask;
    }

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private static JsonObject Document(string title = "Powerplay", string fieldType = "full") => new()
    {
        ["format"] = "tacticalboard.situation",
        ["formatVersion"] = 3,
        ["situation"] = new JsonObject
        {
            ["id"] = "local-id",
            ["title"] = title,
            ["description"] = "Markdown",
            ["sport"] = "floorball",
            ["fieldType"] = fieldType,
            ["createdAt"] = "2020-01-01T00:00:00.000Z",
            ["updatedAt"] = "2020-01-01T00:00:00.000Z",
            ["frames"] = new JsonArray
            {
                new JsonObject
                {
                    ["id"] = "f1",
                    ["description"] = "",
                    ["elements"] = new JsonArray
                    {
                        new JsonObject { ["id"] = "p1", ["type"] = "Player", ["color"] = "red", ["x"] = 1200.5, ["y"] = 300, ["label"] = "C" },
                        new JsonObject
                        {
                            ["id"] = "a1",
                            ["type"] = "Pass",
                            ["color"] = "black",
                            ["start"] = new JsonObject { ["x"] = 1, ["y"] = 2 },
                            ["end"] = new JsonObject { ["x"] = 3, ["y"] = 4 },
                            ["bends"] = new JsonArray(new JsonObject { ["x"] = 2, ["y"] = 3 }),
                        },
                    },
                },
            },
        },
    };

    private async Task<TestBrowser> LoggedInAsync(string subject, string name)
    {
        var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync(subject, TestClaims.Profile(name));
        return browser;
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Cancellation);

    private static async Task<JsonElement> CreateAsync(TestBrowser browser, string title = "Powerplay", string? origin = null)
    {
        using var response = await browser.SendJsonAsync(HttpMethod.Post, PersonalArea, new { document = Document(title), origin }, await browser.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await JsonAsync(response);
    }

    private static async Task<HttpResponseMessage> UpdateAsync(TestBrowser browser, string id, string title, string ifMatch) =>
        await browser.SendJsonAsync(
            HttpMethod.Put,
            $"/api/situations/{id}",
            new { document = Document(title) },
            await browser.AntiforgeryTokenAsync(),
            new Dictionary<string, string> { ["If-Match"] = ifMatch });

    private static async Task<JsonElement> AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await JsonAsync(response);
        Assert.Equal("https://tacticalboard/errors/" + code, problem.GetProperty("type").GetString());
        return problem;
    }

    [Fact]
    public async Task Saves_lists_opens_updates_and_deletes_a_situation()
    {
        using var alice = await LoggedInAsync("alice", "Alice");

        using var created = await alice.SendJsonAsync(HttpMethod.Post, PersonalArea, new { document = Document() }, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("\"1\"", created.Headers.ETag?.ToString());
        var body = await JsonAsync(created);
        var id = body.GetProperty("id").GetString()!;
        Assert.Equal(new Uri($"http://localhost/api/situations/{id}"), created.Headers.Location);
        Assert.Equal("Powerplay", body.GetProperty("title").GetString());
        Assert.Equal("Alice", body.GetProperty("createdBy").GetProperty("displayName").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("folderId").ValueKind);
        var document = body.GetProperty("document").GetProperty("situation");
        Assert.Equal(id, document.GetProperty("id").GetString());
        Assert.NotEqual("2020-01-01T00:00:00.000Z", document.GetProperty("createdAt").GetString());
        Assert.Equal(
            body.GetProperty("createdAt").GetDateTimeOffset(),
            DateTimeOffset.Parse(document.GetProperty("createdAt").GetString()!, System.Globalization.CultureInfo.InvariantCulture));
        Assert.Equal(1200.5, document.GetProperty("frames")[0].GetProperty("elements")[0].GetProperty("x").GetDouble());

        using var list = await alice.GetAsync(PersonalArea);
        var summary = Assert.Single((await JsonAsync(list)).EnumerateArray());
        Assert.Equal(id, summary.GetProperty("id").GetString());
        Assert.False(summary.TryGetProperty("document", out _));

        using var updated = await UpdateAsync(alice, id, "Breakout", "\"1\"");
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal("\"2\"", updated.Headers.ETag?.ToString());

        using var opened = await alice.GetAsync($"/api/situations/{id}");
        Assert.Equal("\"2\"", opened.Headers.ETag?.ToString());
        var openedBody = await JsonAsync(opened);
        Assert.Equal("Breakout", openedBody.GetProperty("title").GetString());
        Assert.Equal("Breakout", openedBody.GetProperty("document").GetProperty("situation").GetProperty("title").GetString());

        using var deleted = await alice.SendJsonAsync(HttpMethod.Delete, $"/api/situations/{id}", null, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        using var afterDelete = await alice.GetAsync($"/api/situations/{id}");
        await AssertProblemAsync(afterDelete, HttpStatusCode.NotFound, "situation-not-found");
        Assert.Empty((await JsonAsync(await alice.GetAsync(PersonalArea))).EnumerateArray());

        Assert.Equal(2, await CountAsync("SELECT count(*) FROM situation_revisions"));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM situations WHERE deleted_at IS NOT NULL"));
    }

    [Fact]
    public async Task Everything_needs_a_session()
    {
        using var anonymous = _factory.CreateBrowser();

        using var list = await anonymous.GetAsync(PersonalArea);
        using var get = await anonymous.GetAsync($"/api/situations/{Guid.NewGuid()}");
        using var post = await anonymous.SendJsonAsync(HttpMethod.Post, PersonalArea, new { document = Document() }, await anonymous.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.Unauthorized, list.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, get.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, post.StatusCode);
    }

    [Fact]
    public async Task Saving_needs_an_antiforgery_token()
    {
        using var alice = await LoggedInAsync("alice", "Alice");

        using var response = await alice.SendJsonAsync(HttpMethod.Post, PersonalArea, new { document = Document() }, antiforgeryToken: null);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid-antiforgery-token");
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM situations"));
    }

    [Fact]
    public async Task Another_users_situation_is_not_found()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var id = (await CreateAsync(alice)).GetProperty("id").GetString()!;
        using var bob = await LoggedInAsync("bob", "Bob");

        using var get = await bob.GetAsync($"/api/situations/{id}");
        using var put = await UpdateAsync(bob, id, "Mine", "\"1\"");
        using var delete = await bob.SendJsonAsync(HttpMethod.Delete, $"/api/situations/{id}", null, await bob.AntiforgeryTokenAsync());
        using var list = await bob.GetAsync(PersonalArea);

        await AssertProblemAsync(get, HttpStatusCode.NotFound, "situation-not-found");
        await AssertProblemAsync(put, HttpStatusCode.NotFound, "situation-not-found");
        await AssertProblemAsync(delete, HttpStatusCode.NotFound, "situation-not-found");
        Assert.Empty((await JsonAsync(list)).EnumerateArray());
    }

    [Fact]
    public async Task Titles_are_unique_per_area_ignoring_case_and_whitespace()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        await CreateAsync(alice, "Powerplay");

        using var duplicate = await alice.SendJsonAsync(HttpMethod.Post, PersonalArea, new { document = Document("  powerplay ") }, await alice.AntiforgeryTokenAsync());
        await AssertProblemAsync(duplicate, HttpStatusCode.Conflict, "duplicate-title");

        var imported = await CreateAsync(alice, "powerplay", origin: "imported");
        var copy = await CreateAsync(alice, "Powerplay", origin: "copy");
        Assert.Equal("powerplay (2)", imported.GetProperty("title").GetString());
        Assert.Equal("Powerplay (3)", copy.GetProperty("title").GetString());

        using var bob = await LoggedInAsync("bob", "Bob");
        Assert.Equal("Powerplay", (await CreateAsync(bob, "Powerplay")).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Default_titles_are_numbered_and_a_deleted_title_is_free_again()
    {
        using var alice = await LoggedInAsync("alice", "Alice");

        var first = await CreateAsync(alice, "Untitled Situation");
        var second = await CreateAsync(alice, "");
        Assert.Equal("Untitled Situation (2)", second.GetProperty("title").GetString());

        using var deleted = await alice.SendJsonAsync(HttpMethod.Delete, $"/api/situations/{first.GetProperty("id").GetString()}", null, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal("Untitled Situation", (await CreateAsync(alice, "Untitled Situation")).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Updating_to_a_taken_title_is_a_conflict()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        await CreateAsync(alice, "Powerplay");
        var other = (await CreateAsync(alice, "Breakout")).GetProperty("id").GetString()!;

        using var response = await UpdateAsync(alice, other, "POWERPLAY", "\"1\"");

        await AssertProblemAsync(response, HttpStatusCode.Conflict, "duplicate-title");
    }

    [Fact]
    public async Task A_save_based_on_an_old_revision_is_a_412_with_the_current_revision()
    {
        using var first = await LoggedInAsync("alice", "Alice");
        var id = (await CreateAsync(first)).GetProperty("id").GetString()!;
        using var second = _factory.CreateBrowser();
        await second.LoginSuccessfullyAsync("alice");
        using var theirs = await UpdateAsync(second, id, "Theirs", "\"1\"");
        Assert.Equal(HttpStatusCode.OK, theirs.StatusCode);

        using var mine = await UpdateAsync(first, id, "Mine", "\"1\"");

        Assert.Equal(HttpStatusCode.PreconditionFailed, mine.StatusCode);
        var problem = await JsonAsync(mine);
        Assert.Equal("https://tacticalboard/errors/save-conflict", problem.GetProperty("type").GetString());
        Assert.Equal(2, problem.GetProperty("currentRevision").GetInt32());

        using var overwrite = await UpdateAsync(first, id, "Mine", "\"2\"");
        Assert.Equal(HttpStatusCode.OK, overwrite.StatusCode);
        Assert.Equal("\"3\"", overwrite.Headers.ETag?.ToString());
    }

    [Fact]
    public async Task Parallel_saves_of_the_same_revision_let_exactly_one_win()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var id = (await CreateAsync(alice)).GetProperty("id").GetString()!;
        var token = await alice.AntiforgeryTokenAsync();

        var saves = Enumerable.Range(1, 5).Select(async index =>
        {
            using var response = await alice.SendJsonAsync(
                HttpMethod.Put,
                $"/api/situations/{id}",
                new { document = Document($"Version {index}") },
                token,
                new Dictionary<string, string> { ["If-Match"] = "\"1\"" });
            return response.StatusCode;
        });
        var statuses = await Task.WhenAll(saves);

        Assert.Equal(1, statuses.Count(status => status == HttpStatusCode.OK));
        Assert.All(statuses.Where(status => status != HttpStatusCode.OK), status => Assert.Equal(HttpStatusCode.PreconditionFailed, status));
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM situation_revisions"));
    }

    [Fact]
    public async Task Parallel_first_saves_with_the_default_title_get_different_numbers()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var token = await alice.AntiforgeryTokenAsync();

        var saves = Enumerable.Range(1, 3).Select(async _ =>
        {
            using var response = await alice.SendJsonAsync(HttpMethod.Post, PersonalArea, new { document = Document("") }, token);
            return response.StatusCode;
        });
        var statuses = await Task.WhenAll(saves);

        Assert.All(statuses, status => Assert.Equal(HttpStatusCode.Created, status));
        var titles = (await JsonAsync(await alice.GetAsync(PersonalArea))).EnumerateArray().Select(item => item.GetProperty("title").GetString()).Order();
        Assert.Equal(["Untitled Situation", "Untitled Situation (2)", "Untitled Situation (3)"], titles);
    }

    [Fact]
    public async Task Saving_needs_if_match()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var id = (await CreateAsync(alice)).GetProperty("id").GetString()!;

        using var response = await alice.SendJsonAsync(HttpMethod.Put, $"/api/situations/{id}", new { document = Document() }, await alice.AntiforgeryTokenAsync());

        await AssertProblemAsync(response, (HttpStatusCode)428, "precondition-required");
    }

    [Fact]
    public async Task An_invalid_document_is_a_validation_problem_listing_every_issue()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var document = Document();
        document["formatVersion"] = 2;
        document["situation"]!["frames"]![0]!["elements"]![0]!["label"] = "ABC";

        using var response = await alice.SendJsonAsync(HttpMethod.Post, PersonalArea, new { document }, await alice.AntiforgeryTokenAsync());

        var errors = (await AssertProblemAsync(response, HttpStatusCode.BadRequest, "validation-failed")).GetProperty("errors");
        Assert.Equal("expected 3 (the current format version)", errors.GetProperty("document.formatVersion")[0].GetString());
        Assert.Equal("expected string of at most 2 letters or digits", errors.GetProperty("document.situation.frames[0].elements[0].label")[0].GetString());
    }

    [Fact]
    public async Task The_field_type_cant_change()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var id = (await CreateAsync(alice)).GetProperty("id").GetString()!;

        using var response = await alice.SendJsonAsync(
            HttpMethod.Put,
            $"/api/situations/{id}",
            new { document = Document(fieldType: "half") },
            await alice.AntiforgeryTokenAsync(),
            new Dictionary<string, string> { ["If-Match"] = "\"1\"" });

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "field-type-changed");
    }

    [Fact]
    public async Task A_deleted_user_is_shown_without_a_name()
    {
        // Personal situations are deleted with their user; team situations (later) keep them.
        // Simulated here by moving Alice's situation into Bob's area before deleting Alice.
        using var alice = await LoggedInAsync("alice", "Alice");
        var id = (await CreateAsync(alice)).GetProperty("id").GetString()!;
        using var bob = await LoggedInAsync("bob", "Bob");
        await ExecuteAsync($"UPDATE situations SET area_id = (SELECT id FROM users WHERE subject = 'bob') WHERE id = '{id}'");
        await UserRows.DeleteAsync(_connectionString, "alice");

        var summary = Assert.Single((await JsonAsync(await bob.GetAsync(PersonalArea))).EnumerateArray());

        Assert.Equal(JsonValueKind.Null, summary.GetProperty("createdBy").GetProperty("displayName").ValueKind);
        Assert.False(string.IsNullOrEmpty(summary.GetProperty("createdBy").GetProperty("id").GetString()));
    }

    [Fact]
    public async Task Stores_the_document_as_jsonb_with_the_metadata_columns()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var id = (await CreateAsync(alice, "  Powerplay  ")).GetProperty("id").GetString()!;

        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(Cancellation);
        await using var command = new NpgsqlCommand(
            """
            SELECT s.title, s.normalized_title, s.area_kind, s.field_type, s.sport, s.format_version, s.current_revision,
                   r.document->'situation'->>'id', pg_typeof(r.document)::text
            FROM situations s JOIN situation_revisions r ON r.situation_id = s.id
            WHERE s.id = @id
            """,
            connection);
        command.Parameters.AddWithValue("id", Guid.Parse(id));
        await using var reader = await command.ExecuteReaderAsync(Cancellation);
        Assert.True(await reader.ReadAsync(Cancellation));

        Assert.Equal("Powerplay", reader.GetString(0));
        Assert.Equal("POWERPLAY", reader.GetString(1));
        Assert.Equal("Personal", reader.GetString(2));
        Assert.Equal(("full", "floorball", 3, 1), (reader.GetString(3), reader.GetString(4), reader.GetInt32(5), reader.GetInt32(6)));
        Assert.Equal(id, reader.GetString(7));
        Assert.Equal("jsonb", reader.GetString(8));
    }

    private async Task<int> CountAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(Cancellation);
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync(Cancellation), System.Globalization.CultureInfo.InvariantCulture);
    }

    private async Task ExecuteAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(Cancellation);
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(Cancellation);
    }
}
