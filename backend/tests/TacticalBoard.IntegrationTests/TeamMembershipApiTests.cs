using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.IntegrationTests.TestSupport;
using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.IntegrationTests;

/// <summary>
/// Membership (arc42 ch. 8.17, roadmap Phase 2 step 7) through the real pipeline and PostgreSQL:
/// join requests, the member list, roles, removing, leaving, deleting a team — and the rules that
/// must hold under parallel requests (at least one Admin, one pending request).
/// </summary>
public sealed class TeamMembershipApiTests(PostgresFixture postgres) : IAsyncLifetime
{
    private const string Teams = "/api/teams";

    private readonly string _connectionString = postgres.NewDatabaseConnectionString();
    private ApiFactory _factory = null!;

    public ValueTask InitializeAsync()
    {
        _factory = ApiFactory.WithDatabase(_connectionString);
        return ValueTask.CompletedTask;
    }

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private async Task<TestBrowser> LoggedInAsync(string subject, string name, ApiFactory? factory = null)
    {
        var browser = (factory ?? _factory).CreateBrowser();
        await browser.LoginSuccessfullyAsync(subject, TestClaims.Profile(name));
        return browser;
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Cancellation);

    private static async Task<JsonElement> GetJsonAsync(TestBrowser browser, string path)
    {
        using var response = await browser.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        var problem = await JsonAsync(response);
        Assert.Equal("https://tacticalboard/errors/" + code, problem.GetProperty("type").GetString());
    }

    private static async Task<HttpResponseMessage> SendAsync(TestBrowser browser, HttpMethod method, string path, object? body = null) =>
        await browser.SendJsonAsync(method, path, body, await browser.AntiforgeryTokenAsync());

    private static async Task<string> CreateTeamAsync(TestBrowser browser, string name)
    {
        using var form = new MultipartFormDataContent { { new StringContent(name), "name" } };
        using var response = await browser.SendFormAsync(HttpMethod.Post, Teams, form, await browser.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await JsonAsync(response)).GetProperty("code").GetString()!;
    }

    private static async Task<Guid> UserIdAsync(TestBrowser browser) => (await browser.MeAsync()).GetProperty("id").GetGuid();

    private static async Task<Guid> RequestToJoinAsync(TestBrowser browser, string code)
    {
        using var response = await SendAsync(browser, HttpMethod.Post, $"{Teams}/{code}/join-requests");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await JsonAsync(response)).GetProperty("id").GetGuid();
    }

    private static async Task JoinAsync(TestBrowser admin, TestBrowser user, string code)
    {
        var requestId = await RequestToJoinAsync(user, code);
        using var accepted = await SendAsync(admin, HttpMethod.Post, $"{Teams}/{code}/join-requests/{requestId}/accept");
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
    }

    private static async Task<HttpResponseMessage> ChangeRoleAsync(TestBrowser admin, string code, Guid userId, string role) =>
        await SendAsync(admin, HttpMethod.Put, $"{Teams}/{code}/members/{userId}/role", new { role });

    private static async Task<List<(string? Name, string Role)>> MembersAsync(TestBrowser browser, string code) =>
        (await GetJsonAsync(browser, $"{Teams}/{code}/members")).EnumerateArray()
            .Select(member => (member.GetProperty("displayName").GetString(), member.GetProperty("role").GetString()!))
            .ToList();

    private async Task<long> CountAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(Cancellation);
        await using var command = new NpgsqlCommand(sql, connection);
        return (long)(await command.ExecuteScalarAsync(Cancellation))!;
    }

    [Fact]
    public async Task A_user_asks_to_join_through_the_link_and_an_Admin_accepts_them_as_Reader()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var code = await CreateTeamAsync(alice, "Lions");
        using var bob = await LoggedInAsync("bob", "Bob");

        using var sent = await SendAsync(bob, HttpMethod.Post, $"{Teams}/{code.ToLowerInvariant()}/join-requests");
        Assert.Equal(HttpStatusCode.Created, sent.StatusCode);
        var request = await JsonAsync(sent);
        Assert.Equal("Bob", request.GetProperty("user").GetProperty("displayName").GetString());
        var asRequester = await GetJsonAsync(bob, $"{Teams}/{code}");
        Assert.True(asRequester.GetProperty("joinRequestPending").GetBoolean());
        Assert.Equal(JsonValueKind.Null, asRequester.GetProperty("code").ValueKind);
        Assert.Equal(1, (await GetJsonAsync(alice, $"{Teams}/{code}")).GetProperty("pendingJoinRequests").GetInt32());
        Assert.Equal(1, Assert.Single((await GetJsonAsync(alice, "/api/me/teams")).EnumerateArray()).GetProperty("pendingJoinRequests").GetInt32());
        var pending = await GetJsonAsync(alice, $"{Teams}/{code}/join-requests");
        Assert.Equal(request.GetProperty("id").GetGuid(), Assert.Single(pending.EnumerateArray()).GetProperty("id").GetGuid());

        using var accepted = await SendAsync(alice, HttpMethod.Post, $"{Teams}/{code}/join-requests/{request.GetProperty("id").GetGuid()}/accept");

        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        var member = await JsonAsync(accepted);
        Assert.Equal(("Bob", "reader"), (member.GetProperty("displayName").GetString(), member.GetProperty("role").GetString()));
        var asMember = await GetJsonAsync(bob, $"{Teams}/{code}");
        Assert.Equal(("reader", code, false), (asMember.GetProperty("role").GetString(), asMember.GetProperty("code").GetString(), asMember.GetProperty("joinRequestPending").GetBoolean()));
        Assert.Equal([("Alice", "admin"), ("Bob", "reader")], await MembersAsync(bob, code));
        Assert.Equal("reader", Assert.Single((await GetJsonAsync(bob, "/api/me/teams")).EnumerateArray()).GetProperty("role").GetString());
        Assert.Empty((await GetJsonAsync(alice, $"{Teams}/{code}/join-requests")).EnumerateArray());
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM team_join_requests WHERE status = 'Accepted'"));
    }

    [Fact]
    public async Task The_member_list_shows_Admins_then_Editors_then_Readers_each_by_name()
    {
        using var zed = await LoggedInAsync("zed", "Zed");
        var code = await CreateTeamAsync(zed, "Lions");
        using var anna = await LoggedInAsync("anna", "Anna");
        using var bert = await LoggedInAsync("bert", "Bert");
        using var carl = await LoggedInAsync("carl", "carl");
        await JoinAsync(zed, anna, code);
        await JoinAsync(zed, bert, code);
        await JoinAsync(zed, carl, code);
        using var editor = await ChangeRoleAsync(zed, code, await UserIdAsync(bert), "editor");
        using var admin = await ChangeRoleAsync(zed, code, await UserIdAsync(carl), "admin");

        Assert.Equal([("carl", "admin"), ("Zed", "admin"), ("Bert", "editor"), ("Anna", "reader")], await MembersAsync(anna, code));
    }

    [Fact]
    public async Task One_pending_request_per_user_also_under_parallel_requests_and_none_from_members()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var code = await CreateTeamAsync(alice, "Lions");
        using var bob = await LoggedInAsync("bob", "Bob");
        var token = await bob.AntiforgeryTokenAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => bob.SendJsonAsync(HttpMethod.Post, $"{Teams}/{code}/join-requests", null, token)));

        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        foreach (var response in responses.Where(response => response.StatusCode != HttpStatusCode.Created))
        {
            await AssertProblemAsync(response, HttpStatusCode.Conflict, "join-request-pending");
        }

        foreach (var response in responses)
        {
            response.Dispose();
        }

        Assert.Equal(1, await CountAsync("SELECT count(*) FROM team_join_requests"));
        using var fromAdmin = await SendAsync(alice, HttpMethod.Post, $"{Teams}/{code}/join-requests");
        await AssertProblemAsync(fromAdmin, HttpStatusCode.Conflict, "already-team-member");
    }

    [Fact]
    public async Task After_a_rejection_the_user_may_ask_again()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var code = await CreateTeamAsync(alice, "Lions");
        using var bob = await LoggedInAsync("bob", "Bob");
        var first = await RequestToJoinAsync(bob, code);

        using var rejected = await SendAsync(alice, HttpMethod.Post, $"{Teams}/{code}/join-requests/{first}/reject");

        Assert.Equal(HttpStatusCode.NoContent, rejected.StatusCode);
        var asRejected = await GetJsonAsync(bob, $"{Teams}/{code}");
        Assert.Equal((false, JsonValueKind.Null), (asRejected.GetProperty("joinRequestPending").GetBoolean(), asRejected.GetProperty("role").ValueKind));
        using var decidedAgain = await SendAsync(alice, HttpMethod.Post, $"{Teams}/{code}/join-requests/{first}/accept");
        await AssertProblemAsync(decidedAgain, HttpStatusCode.NotFound, "join-request-not-found");
        var second = await RequestToJoinAsync(bob, code);
        Assert.NotEqual(first, second);
        Assert.True((await GetJsonAsync(bob, $"{Teams}/{code}")).GetProperty("joinRequestPending").GetBoolean());
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM team_join_requests"));
    }

    [Fact]
    public async Task Two_Admins_deciding_the_same_request_in_parallel_decide_it_once()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var code = await CreateTeamAsync(alice, "Lions");
        using var bob = await LoggedInAsync("bob", "Bob");
        await JoinAsync(alice, bob, code);
        using (var promoted = await ChangeRoleAsync(alice, code, await UserIdAsync(bob), "admin"))
        {
            Assert.Equal(HttpStatusCode.OK, promoted.StatusCode);
        }

        using var carol = await LoggedInAsync("carol", "Carol");
        var requestId = await RequestToJoinAsync(carol, code);

        var responses = await Task.WhenAll(
            SendAsync(alice, HttpMethod.Post, $"{Teams}/{code}/join-requests/{requestId}/accept"),
            SendAsync(bob, HttpMethod.Post, $"{Teams}/{code}/join-requests/{requestId}/reject"));

        Assert.Single(responses, response => response.IsSuccessStatusCode);
        await AssertProblemAsync(Assert.Single(responses, response => !response.IsSuccessStatusCode), HttpStatusCode.NotFound, "join-request-not-found");
        foreach (var response in responses)
        {
            response.Dispose();
        }

        Assert.Equal(0, await CountAsync("SELECT count(*) FROM team_join_requests WHERE status = 'Pending'"));
    }

    [Fact]
    public async Task Only_Admins_see_and_decide_requests_and_manage_members()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var code = await CreateTeamAsync(alice, "Lions");
        using var bob = await LoggedInAsync("bob", "Bob");
        await JoinAsync(alice, bob, code);
        using var carol = await LoggedInAsync("carol", "Carol");
        var requestId = await RequestToJoinAsync(carol, code);
        var aliceId = await UserIdAsync(alice);

        using var list = await bob.GetAsync($"{Teams}/{code}/join-requests");
        using var accept = await SendAsync(bob, HttpMethod.Post, $"{Teams}/{code}/join-requests/{requestId}/accept");
        using var role = await ChangeRoleAsync(bob, code, aliceId, "reader");
        using var remove = await SendAsync(bob, HttpMethod.Delete, $"{Teams}/{code}/members/{aliceId}");
        using var delete = await SendAsync(bob, HttpMethod.Delete, $"{Teams}/{code}");
        using var strangerMembers = await carol.GetAsync($"{Teams}/{code}/members");

        foreach (var response in new[] { list, accept, role, remove, delete, strangerMembers })
        {
            await AssertProblemAsync(response, HttpStatusCode.Forbidden, "forbidden");
        }

        Assert.Equal(JsonValueKind.Null, (await GetJsonAsync(bob, $"{Teams}/{code}")).GetProperty("pendingJoinRequests").ValueKind);
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM team_memberships WHERE deleted_at IS NULL"));
    }

    [Fact]
    public async Task Admins_change_roles_their_own_included_while_the_team_keeps_an_Admin()
    {
        using var trainer = await LoggedInAsync("trainer", "Trainer");
        var code = await CreateTeamAsync(trainer, "Lions");
        using var player = await LoggedInAsync("player", "Player");
        await JoinAsync(trainer, player, code);
        var trainerId = await UserIdAsync(trainer);
        var playerId = await UserIdAsync(player);

        using (var editor = await ChangeRoleAsync(trainer, code, playerId, "editor"))
        {
            Assert.Equal("editor", (await JsonAsync(editor)).GetProperty("role").GetString());
        }

        using (var lastAdminLeaves = await SendAsync(trainer, HttpMethod.Delete, $"{Teams}/{code}/members/me"))
        {
            await AssertProblemAsync(lastAdminLeaves, HttpStatusCode.Conflict, "last-team-admin");
        }

        using (var lastAdminDemoted = await ChangeRoleAsync(trainer, code, trainerId, "reader"))
        {
            await AssertProblemAsync(lastAdminDemoted, HttpStatusCode.Conflict, "last-team-admin");
        }

        using (var promoted = await ChangeRoleAsync(trainer, code, playerId, "admin"))
        {
            Assert.Equal(HttpStatusCode.OK, promoted.StatusCode);
        }

        using (var demoted = await ChangeRoleAsync(trainer, code, trainerId, "reader"))
        {
            Assert.Equal("reader", (await JsonAsync(demoted)).GetProperty("role").GetString());
        }

        Assert.Equal([("Player", "admin"), ("Trainer", "reader")], await MembersAsync(trainer, code));
        using var noLongerAdmin = await ChangeRoleAsync(trainer, code, trainerId, "admin");
        await AssertProblemAsync(noLongerAdmin, HttpStatusCode.Forbidden, "forbidden");
        using var invalid = await ChangeRoleAsync(player, code, trainerId, "owner");
        await AssertProblemAsync(invalid, HttpStatusCode.BadRequest, "validation-failed");
        using var notMember = await ChangeRoleAsync(player, code, Guid.NewGuid(), "editor");
        await AssertProblemAsync(notMember, HttpStatusCode.NotFound, "team-member-not-found");
    }

    [Fact]
    public async Task Two_Admins_demoting_themselves_in_parallel_leave_one_Admin()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var code = await CreateTeamAsync(alice, "Lions");
        using var bob = await LoggedInAsync("bob", "Bob");
        await JoinAsync(alice, bob, code);
        var aliceId = await UserIdAsync(alice);
        var bobId = await UserIdAsync(bob);

        for (var round = 0; round < 5; round++)
        {
            if (round == 0)
            {
                using var promoteBob = await ChangeRoleAsync(alice, code, bobId, "admin");
                Assert.Equal(HttpStatusCode.OK, promoteBob.StatusCode);
            }

            var responses = await Task.WhenAll(ChangeRoleAsync(alice, code, aliceId, "reader"), ChangeRoleAsync(bob, code, bobId, "editor"));

            Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
            await AssertProblemAsync(Assert.Single(responses, response => response.StatusCode != HttpStatusCode.OK), HttpStatusCode.Conflict, "last-team-admin");
            foreach (var response in responses)
            {
                response.Dispose();
            }

            Assert.Equal(1, await CountAsync("SELECT count(*) FROM team_memberships WHERE role = 'Admin' AND deleted_at IS NULL"));

            // The one who is still Admin makes the other Admin again for the next round.
            var aliceIsAdmin = await CountAsync($"SELECT count(*) FROM team_memberships WHERE role = 'Admin' AND deleted_at IS NULL AND user_id = '{aliceId}'") == 1;
            using var restore = await ChangeRoleAsync(aliceIsAdmin ? alice : bob, code, aliceIsAdmin ? bobId : aliceId, "admin");
            Assert.Equal(HttpStatusCode.OK, restore.StatusCode);
        }
    }

    [Fact]
    public async Task Two_Admins_leaving_or_removing_each_other_in_parallel_leave_one_Admin()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var code = await CreateTeamAsync(alice, "Lions");
        using var bob = await LoggedInAsync("bob", "Bob");
        await JoinAsync(alice, bob, code);
        var aliceId = await UserIdAsync(alice);
        using (var promoted = await ChangeRoleAsync(alice, code, await UserIdAsync(bob), "admin"))
        {
            Assert.Equal(HttpStatusCode.OK, promoted.StatusCode);
        }

        var responses = await Task.WhenAll(
            SendAsync(alice, HttpMethod.Delete, $"{Teams}/{code}/members/me"),
            SendAsync(bob, HttpMethod.Delete, $"{Teams}/{code}/members/{aliceId}"),
            SendAsync(bob, HttpMethod.Delete, $"{Teams}/{code}/members/me"));

        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.NoContent);
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM team_memberships WHERE role = 'Admin' AND deleted_at IS NULL"));
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [Fact]
    public async Task A_removed_or_leaving_member_loses_access_at_once_and_may_ask_again()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var code = await CreateTeamAsync(alice, "Lions");
        using var bob = await LoggedInAsync("bob", "Bob");
        await JoinAsync(alice, bob, code);
        Assert.Equal(2, (await MembersAsync(bob, code)).Count);

        using (var removed = await SendAsync(alice, HttpMethod.Delete, $"{Teams}/{code}/members/{await UserIdAsync(bob)}"))
        {
            Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        }

        using (var members = await bob.GetAsync($"{Teams}/{code}/members"))
        {
            await AssertProblemAsync(members, HttpStatusCode.Forbidden, "forbidden");
        }

        var publicView = await GetJsonAsync(bob, $"{Teams}/{code}");
        Assert.Equal((JsonValueKind.Null, JsonValueKind.Null), (publicView.GetProperty("role").ValueKind, publicView.GetProperty("code").ValueKind));
        Assert.Empty((await GetJsonAsync(bob, "/api/me/teams")).EnumerateArray());

        await JoinAsync(alice, bob, code);
        using (var left = await SendAsync(bob, HttpMethod.Delete, $"{Teams}/{code}/members/me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, left.StatusCode);
        }

        Assert.Equal(JsonValueKind.Null, (await GetJsonAsync(bob, $"{Teams}/{code}")).GetProperty("role").ValueKind);
        using var leaveAgain = await SendAsync(bob, HttpMethod.Delete, $"{Teams}/{code}/members/me");
        await AssertProblemAsync(leaveAgain, HttpStatusCode.NotFound, "team-member-not-found");
        Assert.Equal(3, await CountAsync("SELECT count(*) FROM team_memberships"));
    }

    [Fact]
    public async Task Deleting_a_team_soft_deletes_it_with_memberships_pending_requests_and_calls_the_content_hook()
    {
        var participant = new DeletionLog();
        await using var factory = WithParticipant(participant);
        using var alice = new TestBrowser(
            factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true, BaseAddress = new Uri("http://localhost") }),
            _factory.IdentityProvider);
        await alice.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice"));
        var code = await CreateTeamAsync(alice, "Lions");
        using var bob = await LoggedInAsync("bob", "Bob");
        await JoinAsync(alice, bob, code);
        using var carol = await LoggedInAsync("carol", "Carol");
        await RequestToJoinAsync(carol, code);

        using var deleted = await SendAsync(alice, HttpMethod.Delete, $"{Teams}/{code}");

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        var deletion = Assert.Single(participant.Deletions);
        Assert.True(deletion.InTransaction);
        Assert.Equal(await UserIdAsync(alice), deletion.Deletion.DeletedBy);
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM teams WHERE deleted_at IS NOT NULL"));
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM team_memberships WHERE deleted_at IS NULL"));
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM team_join_requests WHERE status = 'Pending' AND deleted_at IS NULL"));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM team_join_requests WHERE status = 'Pending' AND deleted_at IS NOT NULL"));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM team_join_requests WHERE status = 'Accepted' AND deleted_at IS NULL"));
        using var gone = await bob.GetAsync($"{Teams}/{code}");
        await AssertProblemAsync(gone, HttpStatusCode.NotFound, "team-not-found");
        Assert.Empty((await GetJsonAsync(bob, "/api/me/teams")).EnumerateArray());
        Assert.Empty((await GetJsonAsync(carol, Teams)).GetProperty("items").EnumerateArray());
        using var requestToDeleted = await SendAsync(carol, HttpMethod.Post, $"{Teams}/{code}/join-requests");
        await AssertProblemAsync(requestToDeleted, HttpStatusCode.NotFound, "team-not-found");

        var again = await CreateTeamAsync(alice, "Lions");
        Assert.NotEqual(code, again);
    }

    [Fact]
    public async Task A_failing_content_hook_cancels_the_deletion()
    {
        var participant = new DeletionLog { Fail = true };
        await using var factory = WithParticipant(participant);
        using var alice = new TestBrowser(
            factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true, BaseAddress = new Uri("http://localhost") }),
            _factory.IdentityProvider);
        await alice.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice"));
        var code = await CreateTeamAsync(alice, "Lions");

        using var deleted = await SendAsync(alice, HttpMethod.Delete, $"{Teams}/{code}");

        Assert.Equal(HttpStatusCode.InternalServerError, deleted.StatusCode);
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM teams WHERE deleted_at IS NOT NULL"));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM team_memberships WHERE deleted_at IS NULL"));
    }

    [Fact]
    public async Task Membership_endpoints_need_a_session_and_the_antiforgery_token()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var code = await CreateTeamAsync(alice, "Lions");
        using var anonymous = _factory.CreateBrowser();

        using var members = await anonymous.GetAsync($"{Teams}/{code}/members");
        using var withoutToken = await alice.SendJsonAsync(HttpMethod.Delete, $"{Teams}/{code}", null, antiforgeryToken: null);

        await AssertProblemAsync(members, HttpStatusCode.Unauthorized, "unauthorized");
        await AssertProblemAsync(withoutToken, HttpStatusCode.BadRequest, "invalid-antiforgery-token");
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM teams WHERE deleted_at IS NOT NULL"));
    }

    private WebApplicationFactory<Program> WithParticipant(DeletionLog log) =>
        _factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddScoped<ITeamDeletionParticipant>(provider => new RecordingParticipant(provider.GetRequiredService<TacticalBoardDbContext>(), log))));

    /// <summary>The team deletions a <see cref="RecordingParticipant"/> took part in, with whether a database transaction was running.</summary>
    private sealed class DeletionLog
    {
        public List<(TeamDeletion Deletion, bool InTransaction)> Deletions { get; } = [];

        public bool Fail { get; init; }
    }

    /// <summary>A content module taking part in team deletions (like Areas from step 8 on), on the request's database context.</summary>
    private sealed class RecordingParticipant(TacticalBoardDbContext context, DeletionLog log) : ITeamDeletionParticipant
    {
        public Task TeamDeletingAsync(TeamDeletion deletion, CancellationToken cancellationToken)
        {
            log.Deletions.Add((deletion, context.Database.CurrentTransaction is not null));
            return log.Fail ? Task.FromException(new InvalidOperationException("The content can't be deleted.")) : Task.CompletedTask;
        }
    }
}
