using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;
using TacticalBoard.IntegrationTests.TestSupport;

namespace TacticalBoard.IntegrationTests;

/// <summary>
/// Team situations and folders (arc42 ch. 8.1, 8.15, roadmap Phase 2 step 8) through the real
/// pipeline and PostgreSQL: the role matrix per endpoint, non-members and system administrators
/// without a membership, moves only within the area, and deleting a team with its content.
/// </summary>
public sealed class TeamContentApiTests(PostgresFixture postgres) : IAsyncLifetime
{
    private const string Teams = "/api/teams";

    private readonly string _connectionString = postgres.NewDatabaseConnectionString();
    private ApiFactory _factory = null!;

    public ValueTask InitializeAsync()
    {
        _factory = ApiFactory.WithDatabase(_connectionString, settings: new Dictionary<string, string?>
        {
            ["Bootstrap:SystemAdministrators"] = FakeIdentityProvider.Issuer + "|boss",
        });
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

    private static async Task<HttpResponseMessage> SendAsync(TestBrowser browser, HttpMethod method, string path, object? body = null) =>
        await browser.SendJsonAsync(method, path, body, await browser.AntiforgeryTokenAsync());

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("https://tacticalboard/errors/" + code, (await JsonAsync(response)).GetProperty("type").GetString());
    }

    private static async Task<JsonElement> GetJsonAsync(TestBrowser browser, string path)
    {
        using var response = await browser.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    private static async Task<(string Code, Guid Id)> CreateTeamAsync(TestBrowser browser, string name)
    {
        using var form = new MultipartFormDataContent { { new StringContent(name), "name" } };
        using var response = await browser.SendFormAsync(HttpMethod.Post, Teams, form, await browser.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var team = await JsonAsync(response);
        return (team.GetProperty("code").GetString()!, team.GetProperty("id").GetGuid());
    }

    private static async Task JoinAsync(TestBrowser admin, TestBrowser user, string code, string role = "reader")
    {
        using var sent = await SendAsync(user, HttpMethod.Post, $"{Teams}/{code}/join-requests");
        Assert.Equal(HttpStatusCode.Created, sent.StatusCode);
        var requestId = (await JsonAsync(sent)).GetProperty("id").GetGuid();
        using var accepted = await SendAsync(admin, HttpMethod.Post, $"{Teams}/{code}/join-requests/{requestId}/accept");
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        if (role != "reader")
        {
            await ChangeRoleAsync(admin, user, code, role);
        }
    }

    private static async Task ChangeRoleAsync(TestBrowser admin, TestBrowser user, string code, string role)
    {
        var userId = (await user.MeAsync()).GetProperty("id").GetGuid();
        using var changed = await SendAsync(admin, HttpMethod.Put, $"{Teams}/{code}/members/{userId}/role", new { role });
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
    }

    private static async Task<JsonElement> CreateFolderAsync(TestBrowser browser, string code, string name)
    {
        using var response = await SendAsync(browser, HttpMethod.Post, $"{Teams}/{code}/folders", new { name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await JsonAsync(response);
    }

    private static async Task<JsonElement> CreateSituationAsync(TestBrowser browser, string path, string title, string? origin = null)
    {
        using var response = await SendAsync(browser, HttpMethod.Post, path, new { document = SituationJson.Document(title), origin });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await JsonAsync(response);
    }

    private async Task<long> CountAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(Cancellation);
        await using var command = new NpgsqlCommand(sql, connection);
        return (long)(await command.ExecuteScalarAsync(Cancellation))!;
    }

    [Fact]
    public async Task Admins_create_folders_and_situations_in_the_team_and_every_member_sees_them()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var (code, teamId) = await CreateTeamAsync(trainer, "Lions");
        using var player = await LoggedInAsync("player", "Player");
        await JoinAsync(trainer, player, code);

        var folder = await CreateFolderAsync(trainer, code.ToLowerInvariant(), "Set pieces");
        var top = await CreateSituationAsync(trainer, $"{Teams}/{teamId}/situations", "Powerplay");
        var inFolder = await CreateSituationAsync(trainer, $"/api/folders/{folder.GetProperty("id").GetGuid()}/situations", "Free hit");

        Assert.Equal(("team", teamId, true), (folder.GetProperty("area").GetProperty("kind").GetString(), folder.GetProperty("area").GetProperty("id").GetGuid(), folder.GetProperty("canWrite").GetBoolean()));
        Assert.Equal(("team", teamId), (top.GetProperty("area").GetProperty("kind").GetString(), top.GetProperty("area").GetProperty("id").GetGuid()));
        var folders = await GetJsonAsync(player, $"{Teams}/{code}/folders");
        var listed = Assert.Single(folders.EnumerateArray());
        Assert.Equal(("Set pieces", 1, false), (listed.GetProperty("name").GetString(), listed.GetProperty("situationCount").GetInt32(), listed.GetProperty("canWrite").GetBoolean()));
        var situations = await GetJsonAsync(player, $"{Teams}/{code}/situations");
        Assert.Equal(["Powerplay"], situations.EnumerateArray().Select(situation => situation.GetProperty("title").GetString()));
        Assert.False(situations[0].GetProperty("canWrite").GetBoolean());
        var opened = await GetJsonAsync(player, $"/api/situations/{inFolder.GetProperty("id").GetGuid()}");
        Assert.Equal(("Free hit", "Trainer", false), (opened.GetProperty("title").GetString(), opened.GetProperty("createdBy").GetProperty("displayName").GetString(), opened.GetProperty("canWrite").GetBoolean()));
        Assert.Equal("Free hit", (await GetJsonAsync(player, $"/api/folders/{folder.GetProperty("id").GetGuid()}/situations"))[0].GetProperty("title").GetString());
        Assert.False((await GetJsonAsync(player, $"/api/folders/{folder.GetProperty("id").GetGuid()}")).GetProperty("canWrite").GetBoolean());
        Assert.Empty((await GetJsonAsync(trainer, "/api/personal-area/situations")).EnumerateArray());
        Assert.Empty((await GetJsonAsync(trainer, "/api/personal-area/folders")).EnumerateArray());
    }

    [Fact]
    public async Task Readers_are_refused_every_write_with_403()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var (code, _) = await CreateTeamAsync(trainer, "Lions");
        using var player = await LoggedInAsync("player", "Player");
        await JoinAsync(trainer, player, code);
        var folder = (await CreateFolderAsync(trainer, code, "Set pieces")).GetProperty("id").GetGuid();
        var situation = (await CreateSituationAsync(trainer, $"{Teams}/{code}/situations", "Powerplay")).GetProperty("id").GetGuid();

        using var createFolder = await SendAsync(player, HttpMethod.Post, $"{Teams}/{code}/folders", new { name = "Mine" });
        using var renameFolder = await SendAsync(player, HttpMethod.Put, $"/api/folders/{folder}", new { name = "Mine" });
        using var deleteFolder = await SendAsync(player, HttpMethod.Delete, $"/api/folders/{folder}");
        using var createTop = await SendAsync(player, HttpMethod.Post, $"{Teams}/{code}/situations", new { document = SituationJson.Document("Mine") });
        using var createInFolder = await SendAsync(player, HttpMethod.Post, $"/api/folders/{folder}/situations", new { document = SituationJson.Document("Mine") });
        using var update = await player.SendJsonAsync(HttpMethod.Put, $"/api/situations/{situation}", new { document = SituationJson.Document("Changed") }, await player.AntiforgeryTokenAsync(), new Dictionary<string, string> { ["If-Match"] = "\"1\"" });
        using var move = await SendAsync(player, HttpMethod.Put, $"/api/situations/{situation}/folder", new { folderId = folder });
        using var delete = await SendAsync(player, HttpMethod.Delete, $"/api/situations/{situation}");

        foreach (var response in new[] { createFolder, renameFolder, deleteFolder, createTop, createInFolder, update, move, delete })
        {
            await AssertProblemAsync(response, HttpStatusCode.Forbidden, "forbidden");
        }

        Assert.Equal(1, await CountAsync("SELECT count(*) FROM situations WHERE deleted_at IS NULL"));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM situation_revisions"));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM folders WHERE deleted_at IS NULL AND name = 'Set pieces'"));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM situations WHERE folder_id IS NULL"));
    }

    [Theory]
    [InlineData("editor")]
    [InlineData("admin")]
    public async Task Editors_and_Admins_may_do_everything_with_the_content(string role)
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var (code, _) = await CreateTeamAsync(trainer, "Lions");
        using var player = await LoggedInAsync("player", "Player");
        await JoinAsync(trainer, player, code, role);

        var folder = (await CreateFolderAsync(player, code, "Set pieces")).GetProperty("id").GetGuid();
        using var renamed = await SendAsync(player, HttpMethod.Put, $"/api/folders/{folder}", new { name = "Breakouts" });
        var situation = await CreateSituationAsync(player, $"{Teams}/{code}/situations", "Powerplay");
        var id = situation.GetProperty("id").GetGuid();
        using var updated = await player.SendJsonAsync(HttpMethod.Put, $"/api/situations/{id}", new { document = SituationJson.Document("Powerplay 2") }, await player.AntiforgeryTokenAsync(), new Dictionary<string, string> { ["If-Match"] = "\"1\"" });
        using var moved = await SendAsync(player, HttpMethod.Put, $"/api/situations/{id}/folder", new { folderId = folder });
        using var notEmpty = await SendAsync(player, HttpMethod.Delete, $"/api/folders/{folder}");
        using var deleted = await SendAsync(player, HttpMethod.Delete, $"/api/situations/{id}");
        using var folderDeleted = await SendAsync(player, HttpMethod.Delete, $"/api/folders/{folder}");

        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        Assert.True(situation.GetProperty("canWrite").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal("Player", (await JsonAsync(updated)).GetProperty("updatedBy").GetProperty("displayName").GetString());
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        await AssertProblemAsync(notEmpty, HttpStatusCode.Conflict, "folder-not-empty");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, folderDeleted.StatusCode);
    }

    [Fact]
    public async Task Non_members_get_403_for_the_teams_lists_and_404_for_its_folders_and_situations()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var (code, teamId) = await CreateTeamAsync(trainer, "Lions");
        var folder = (await CreateFolderAsync(trainer, code, "Set pieces")).GetProperty("id").GetGuid();
        var situation = (await CreateSituationAsync(trainer, $"{Teams}/{code}/situations", "Powerplay")).GetProperty("id").GetGuid();
        using var stranger = await LoggedInAsync("stranger", "Stranger");

        await AssertNoAccessAsync(stranger, code, teamId, folder, situation);
    }

    [Fact]
    public async Task A_system_administrator_without_a_membership_has_no_access_to_team_content()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var (code, teamId) = await CreateTeamAsync(trainer, "Lions");
        var folder = (await CreateFolderAsync(trainer, code, "Set pieces")).GetProperty("id").GetGuid();
        var situation = (await CreateSituationAsync(trainer, $"{Teams}/{code}/situations", "Powerplay")).GetProperty("id").GetGuid();
        using var boss = await LoggedInAsync("boss", "Boss");
        Assert.True((await boss.MeAsync()).GetProperty("isSystemAdministrator").GetBoolean());

        await AssertNoAccessAsync(boss, code, teamId, folder, situation);
    }

    private static async Task AssertNoAccessAsync(TestBrowser browser, string code, Guid teamId, Guid folder, Guid situation)
    {
        using var folders = await browser.GetAsync($"{Teams}/{code}/folders");
        using var situations = await browser.GetAsync($"{Teams}/{teamId}/situations");
        using var createFolder = await SendAsync(browser, HttpMethod.Post, $"{Teams}/{code}/folders", new { name = "Mine" });
        using var createSituation = await SendAsync(browser, HttpMethod.Post, $"{Teams}/{code}/situations", new { document = SituationJson.Document("Mine") });
        await AssertProblemAsync(folders, HttpStatusCode.Forbidden, "forbidden");
        await AssertProblemAsync(situations, HttpStatusCode.Forbidden, "forbidden");
        await AssertProblemAsync(createFolder, HttpStatusCode.Forbidden, "forbidden");
        await AssertProblemAsync(createSituation, HttpStatusCode.Forbidden, "forbidden");

        using var getFolder = await browser.GetAsync($"/api/folders/{folder}");
        using var folderSituations = await browser.GetAsync($"/api/folders/{folder}/situations");
        using var renameFolder = await SendAsync(browser, HttpMethod.Put, $"/api/folders/{folder}", new { name = "Mine" });
        using var getSituation = await browser.GetAsync($"/api/situations/{situation}");
        using var deleteSituation = await SendAsync(browser, HttpMethod.Delete, $"/api/situations/{situation}");
        await AssertProblemAsync(getFolder, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(folderSituations, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(renameFolder, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(getSituation, HttpStatusCode.NotFound, "situation-not-found");
        await AssertProblemAsync(deleteSituation, HttpStatusCode.NotFound, "situation-not-found");
    }

    [Fact]
    public async Task An_unknown_team_or_malformed_key_is_team_not_found()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");

        using var unknown = await trainer.GetAsync($"{Teams}/ZZZ999/folders");
        using var malformed = await trainer.GetAsync($"{Teams}/not-a-team/situations");
        using var create = await SendAsync(trainer, HttpMethod.Post, $"{Teams}/{Guid.NewGuid()}/situations", new { document = SituationJson.Document() });

        await AssertProblemAsync(unknown, HttpStatusCode.NotFound, "team-not-found");
        await AssertProblemAsync(malformed, HttpStatusCode.NotFound, "team-not-found");
        await AssertProblemAsync(create, HttpStatusCode.NotFound, "team-not-found");
    }

    [Fact]
    public async Task Without_a_session_the_team_endpoints_are_401()
    {
        using var anonymous = _factory.CreateBrowser();

        using var folders = await anonymous.GetAsync($"{Teams}/ABC123/folders");
        using var situations = await anonymous.GetAsync($"{Teams}/ABC123/situations");

        Assert.Equal(HttpStatusCode.Unauthorized, folders.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, situations.StatusCode);
    }

    [Fact]
    public async Task Situations_never_move_between_a_team_and_a_personal_area_or_between_teams()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var (lions, _) = await CreateTeamAsync(trainer, "Lions");
        var (tigers, _) = await CreateTeamAsync(trainer, "Tigers");
        var lionsFolder = (await CreateFolderAsync(trainer, lions, "Set pieces")).GetProperty("id").GetGuid();
        var tigersFolder = (await CreateFolderAsync(trainer, tigers, "Set pieces")).GetProperty("id").GetGuid();
        using var personalFolderResponse = await SendAsync(trainer, HttpMethod.Post, "/api/personal-area/folders", new { name = "Mine" });
        var personalFolder = (await JsonAsync(personalFolderResponse)).GetProperty("id").GetGuid();
        var teamSituation = (await CreateSituationAsync(trainer, $"{Teams}/{lions}/situations", "Powerplay")).GetProperty("id").GetGuid();
        var personalSituation = (await CreateSituationAsync(trainer, "/api/personal-area/situations", "Powerplay")).GetProperty("id").GetGuid();

        using var toPersonal = await SendAsync(trainer, HttpMethod.Put, $"/api/situations/{teamSituation}/folder", new { folderId = personalFolder });
        using var toOtherTeam = await SendAsync(trainer, HttpMethod.Put, $"/api/situations/{teamSituation}/folder", new { folderId = tigersFolder });
        using var toTeam = await SendAsync(trainer, HttpMethod.Put, $"/api/situations/{personalSituation}/folder", new { folderId = lionsFolder });

        await AssertProblemAsync(toPersonal, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(toOtherTeam, HttpStatusCode.NotFound, "folder-not-found");
        await AssertProblemAsync(toTeam, HttpStatusCode.NotFound, "folder-not-found");
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM situations WHERE folder_id IS NULL"));
    }

    [Fact]
    public async Task Titles_and_default_titles_are_unique_per_team_and_copies_stay_in_the_team()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var (code, teamId) = await CreateTeamAsync(trainer, "Lions");
        await CreateSituationAsync(trainer, "/api/personal-area/situations", "Powerplay");

        var first = await CreateSituationAsync(trainer, $"{Teams}/{code}/situations", "Powerplay");
        using var duplicate = await SendAsync(trainer, HttpMethod.Post, $"{Teams}/{code}/situations", new { document = SituationJson.Document("POWERPLAY") });
        var copy = await CreateSituationAsync(trainer, $"{Teams}/{code}/situations", "Powerplay", "copy");
        var untitled = await CreateSituationAsync(trainer, $"{Teams}/{code}/situations", "");
        var untitled2 = await CreateSituationAsync(trainer, $"{Teams}/{code}/situations", " ");

        Assert.Equal("Powerplay", first.GetProperty("title").GetString());
        await AssertProblemAsync(duplicate, HttpStatusCode.Conflict, "duplicate-title");
        Assert.Equal(("Powerplay (2)", teamId), (copy.GetProperty("title").GetString(), copy.GetProperty("area").GetProperty("id").GetGuid()));
        Assert.Equal(("Untitled Situation", "Untitled Situation (2)"), (untitled.GetProperty("title").GetString(), untitled2.GetProperty("title").GetString()));
    }

    [Fact]
    public async Task Two_editors_saving_the_same_revision_get_a_save_conflict_and_a_demoted_editor_gets_403()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var (code, _) = await CreateTeamAsync(trainer, "Lions");
        using var player = await LoggedInAsync("player", "Player");
        await JoinAsync(trainer, player, code, "editor");
        var id = (await CreateSituationAsync(trainer, $"{Teams}/{code}/situations", "Powerplay")).GetProperty("id").GetGuid();

        using var playerSave = await player.SendJsonAsync(HttpMethod.Put, $"/api/situations/{id}", new { document = SituationJson.Document("By player") }, await player.AntiforgeryTokenAsync(), new Dictionary<string, string> { ["If-Match"] = "\"1\"" });
        using var trainerSave = await trainer.SendJsonAsync(HttpMethod.Put, $"/api/situations/{id}", new { document = SituationJson.Document("By trainer") }, await trainer.AntiforgeryTokenAsync(), new Dictionary<string, string> { ["If-Match"] = "\"1\"" });
        Assert.Equal(HttpStatusCode.OK, playerSave.StatusCode);
        Assert.Equal(HttpStatusCode.PreconditionFailed, trainerSave.StatusCode);
        Assert.Equal(2, (await JsonAsync(trainerSave)).GetProperty("currentRevision").GetInt32());

        await ChangeRoleAsync(trainer, player, code, "reader");
        using var demoted = await player.SendJsonAsync(HttpMethod.Put, $"/api/situations/{id}", new { document = SituationJson.Document("Again") }, await player.AntiforgeryTokenAsync(), new Dictionary<string, string> { ["If-Match"] = "\"2\"" });

        await AssertProblemAsync(demoted, HttpStatusCode.Forbidden, "forbidden");
        Assert.False((await GetJsonAsync(player, $"/api/situations/{id}")).GetProperty("canWrite").GetBoolean());
    }

    [Fact]
    public async Task A_member_who_leaves_loses_access_with_the_next_request()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var (code, _) = await CreateTeamAsync(trainer, "Lions");
        using var player = await LoggedInAsync("player", "Player");
        await JoinAsync(trainer, player, code, "editor");
        var id = (await CreateSituationAsync(player, $"{Teams}/{code}/situations", "Powerplay")).GetProperty("id").GetGuid();

        using var left = await SendAsync(player, HttpMethod.Delete, $"{Teams}/{code}/members/me");
        Assert.Equal(HttpStatusCode.NoContent, left.StatusCode);
        using var get = await player.GetAsync($"/api/situations/{id}");

        await AssertProblemAsync(get, HttpStatusCode.NotFound, "situation-not-found");
        Assert.Equal("Player", (await GetJsonAsync(trainer, $"/api/situations/{id}")).GetProperty("createdBy").GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task Deleting_a_team_soft_deletes_its_folders_and_situations_and_nothing_else()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var (code, teamId) = await CreateTeamAsync(trainer, "Lions");
        var (otherCode, _) = await CreateTeamAsync(trainer, "Tigers");
        var folder = (await CreateFolderAsync(trainer, code, "Set pieces")).GetProperty("id").GetGuid();
        await CreateSituationAsync(trainer, $"/api/folders/{folder}/situations", "In folder");
        var top = (await CreateSituationAsync(trainer, $"{Teams}/{code}/situations", "Top")).GetProperty("id").GetGuid();
        await CreateFolderAsync(trainer, otherCode, "Set pieces");
        await CreateSituationAsync(trainer, $"{Teams}/{otherCode}/situations", "Other team");
        await CreateSituationAsync(trainer, "/api/personal-area/situations", "Personal");

        using var deleted = await SendAsync(trainer, HttpMethod.Delete, $"{Teams}/{code}");

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(2, await CountAsync($"SELECT count(*) FROM situations WHERE area_id = '{teamId}' AND deleted_at IS NOT NULL"));
        Assert.Equal(1, await CountAsync($"SELECT count(*) FROM folders WHERE area_id = '{teamId}' AND deleted_at IS NOT NULL"));
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM situations WHERE deleted_at IS NULL"));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM folders WHERE deleted_at IS NULL"));
        Assert.Equal(1, await CountAsync($"SELECT count(DISTINCT deleted_at) FROM (SELECT deleted_at FROM situations WHERE area_id = '{teamId}' UNION ALL SELECT deleted_at FROM folders WHERE area_id = '{teamId}' UNION ALL SELECT deleted_at FROM teams WHERE id = '{teamId}') AS stamps"));
        Assert.Equal(3, await CountAsync($"SELECT count(*) FROM situation_revisions r JOIN situations s ON s.id = r.situation_id WHERE s.area_id = '{teamId}' OR s.title = 'Other team'"));
        using var list = await trainer.GetAsync($"{Teams}/{code}/situations");
        using var get = await trainer.GetAsync($"/api/situations/{top}");
        using var getFolder = await trainer.GetAsync($"/api/folders/{folder}");
        await AssertProblemAsync(list, HttpStatusCode.NotFound, "team-not-found");
        await AssertProblemAsync(get, HttpStatusCode.NotFound, "situation-not-found");
        await AssertProblemAsync(getFolder, HttpStatusCode.NotFound, "folder-not-found");
    }
}
