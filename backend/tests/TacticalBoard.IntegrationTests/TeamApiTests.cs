using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SkiaSharp;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.IntegrationTests.TestSupport;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Domain;
using TacticalBoard.Teams.Infrastructure;

namespace TacticalBoard.IntegrationTests;

/// <summary>Teams (arc42 ch. 8.17) through the real pipeline and PostgreSQL: create with a logo, overview and search, team page, rename, logo round trip.</summary>
public sealed class TeamApiTests(PostgresFixture postgres) : IAsyncLifetime
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

    private static byte[] Image(int width, int height, SKEncodedImageFormat format = SKEncodedImageFormat.Png)
    {
        using var bitmap = new SKBitmap(width, height);
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(new SKColor(30, 120, 200));
        }

        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, 90);
        return data.ToArray();
    }

    private static MultipartFormDataContent Form(string? name, byte[]? logo, string fileName = "logo.png", string contentType = "image/png")
    {
        var form = new MultipartFormDataContent();
        if (name is not null)
        {
            form.Add(new StringContent(name), "name");
        }

        if (logo is not null)
        {
            var file = new ByteArrayContent(logo);
            file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            form.Add(file, "logo", fileName);
        }

        return form;
    }

    private static async Task<HttpResponseMessage> PostTeamAsync(TestBrowser browser, string? name, byte[]? logo = null, string fileName = "logo.png")
    {
        using var form = Form(name, logo, fileName);
        return await browser.SendFormAsync(HttpMethod.Post, Teams, form, await browser.AntiforgeryTokenAsync());
    }

    private static async Task<JsonElement> CreateTeamAsync(TestBrowser browser, string name, byte[]? logo = null)
    {
        using var response = await PostTeamAsync(browser, name, logo);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await JsonAsync(response);
    }

    private static async Task<JsonElement> GetJsonAsync(TestBrowser browser, string path)
    {
        using var response = await browser.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    private static async Task<List<string>> SearchNamesAsync(TestBrowser browser, string query)
    {
        var page = await GetJsonAsync(browser, $"{Teams}?{query}");
        return page.GetProperty("items").EnumerateArray().Select(team => team.GetProperty("name").GetString()!).ToList();
    }

    private static async Task<JsonElement> AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await JsonAsync(response);
        Assert.Equal("https://tacticalboard/errors/" + code, problem.GetProperty("type").GetString());
        return problem;
    }

    private async Task<long> CountAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(Cancellation);
        await using var command = new NpgsqlCommand(sql, connection);
        return (long)(await command.ExecuteScalarAsync(Cancellation))!;
    }

    [Fact]
    public async Task Creates_a_team_with_a_logo_and_its_creator_as_Admin()
    {
        using var alice = await LoggedInAsync("alice", "Alice");

        using var response = await PostTeamAsync(alice, "  Lions Zürich ", Image(1024, 512));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var team = await JsonAsync(response);
        var code = team.GetProperty("code").GetString()!;
        Assert.Matches("^[A-Z0-9]{6}$", code);
        Assert.Equal(new Uri($"http://localhost/api/teams/{code}"), response.Headers.Location);
        Assert.Equal("Lions Zürich", team.GetProperty("name").GetString());
        Assert.Equal("admin", team.GetProperty("role").GetString());
        Assert.StartsWith($"/api/teams/{code}/logo?v=", team.GetProperty("logoUrl").GetString(), StringComparison.Ordinal);
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM team_memberships WHERE role = 'Admin'"));

        var mine = await GetJsonAsync(alice, "/api/me/teams");
        var listed = Assert.Single(mine.EnumerateArray());
        Assert.Equal((code, "admin"), (listed.GetProperty("code").GetString(), listed.GetProperty("role").GetString()));
    }

    [Fact]
    public async Task The_logo_round_trip_scales_serves_with_etag_replaces_and_removes()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var team = await CreateTeamAsync(alice, "Lions", Image(800, 400, SKEncodedImageFormat.Jpeg));
        var code = team.GetProperty("code").GetString()!;
        var logoUrl = team.GetProperty("logoUrl").GetString()!;

        using var logo = await alice.GetAsync(logoUrl);
        Assert.Equal(HttpStatusCode.OK, logo.StatusCode);
        Assert.Equal("image/png", logo.Content.Headers.ContentType?.MediaType);
        Assert.True(logo.Headers.CacheControl is { Private: true, NoCache: true }, logo.Headers.CacheControl?.ToString());
        var etag = logo.Headers.ETag!;
        Assert.Equal($"\"{logoUrl[(logoUrl.IndexOf("v=", StringComparison.Ordinal) + 2)..]}\"", etag.Tag);
        using (var decoded = SKBitmap.Decode(await logo.Content.ReadAsByteArrayAsync(Cancellation)))
        {
            Assert.Equal((256, 128), (decoded.Width, decoded.Height));
        }

        using var revalidation = new HttpRequestMessage(HttpMethod.Get, new Uri(logoUrl, UriKind.Relative));
        revalidation.Headers.IfNoneMatch.Add(etag);
        using var notModified = await alice.Client.SendAsync(revalidation, Cancellation);
        Assert.Equal(HttpStatusCode.NotModified, notModified.StatusCode);

        using var bob = await LoggedInAsync("bob", "Bob");
        using var asOtherUser = await bob.GetAsync(logoUrl);
        Assert.Equal(HttpStatusCode.OK, asOtherUser.StatusCode);

        using var replaceForm = Form(null, Image(100, 200));
        using var replaced = await alice.SendFormAsync(HttpMethod.Put, $"{Teams}/{code}/logo", replaceForm, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
        var newUrl = (await JsonAsync(replaced)).GetProperty("logoUrl").GetString()!;
        Assert.NotEqual(logoUrl, newUrl);
        using var newLogo = await alice.GetAsync(newUrl);
        using (var decoded = SKBitmap.Decode(await newLogo.Content.ReadAsByteArrayAsync(Cancellation)))
        {
            Assert.Equal((100, 200), (decoded.Width, decoded.Height));
        }

        Assert.Equal(1, await CountAsync("SELECT count(*) FROM team_logos"));

        using var removed = await alice.SendJsonAsync(HttpMethod.Delete, $"{Teams}/{code}/logo", null, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await GetJsonAsync(alice, $"{Teams}/{code}")).GetProperty("logoUrl").ValueKind);
        using var gone = await alice.GetAsync($"{Teams}/{code}/logo");
        await AssertProblemAsync(gone, HttpStatusCode.NotFound, "team-logo-not-found");
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM team_logos"));
    }

    [Fact]
    public async Task Another_user_finds_the_team_by_name_or_code_and_opens_it_without_a_role()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var lions = await CreateTeamAsync(alice, "Lions Zürich");
        await CreateTeamAsync(alice, "Tigers");
        await CreateTeamAsync(alice, "100% Hockey");
        var code = lions.GetProperty("code").GetString()!;
        using var bob = await LoggedInAsync("bob", "Bob");

        Assert.Equal(["100% Hockey", "Lions Zürich", "Tigers"], await SearchNamesAsync(bob, string.Empty));
        Assert.Equal(["Lions Zürich"], await SearchNamesAsync(bob, "search=" + Uri.EscapeDataString(" zÜRI ")));
        Assert.Contains("Lions Zürich", await SearchNamesAsync(bob, "search=" + code[1..5].ToLowerInvariant()));
        Assert.Equal(["100% Hockey"], await SearchNamesAsync(bob, "search=" + Uri.EscapeDataString("%")));
        Assert.Empty(await SearchNamesAsync(bob, "search=_"));

        var page = await GetJsonAsync(bob, $"{Teams}/{code.ToLowerInvariant()}");
        Assert.Equal(("Lions Zürich", code, JsonValueKind.Null), (page.GetProperty("name").GetString(), page.GetProperty("code").GetString(), page.GetProperty("role").ValueKind));
        Assert.Empty((await GetJsonAsync(bob, "/api/me/teams")).EnumerateArray());
    }

    [Fact]
    public async Task The_overview_is_paged_and_counts_all_matches()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        foreach (var name in new[] { "Delta", "alpha", "Charlie", "Bravo" })
        {
            await CreateTeamAsync(alice, name);
        }

        var first = await GetJsonAsync(alice, $"{Teams}?limit=3");
        var rest = await GetJsonAsync(alice, $"{Teams}?limit=3&offset=3");

        Assert.Equal(4, first.GetProperty("total").GetInt32());
        Assert.Equal(["alpha", "Bravo", "Charlie"], first.GetProperty("items").EnumerateArray().Select(team => team.GetProperty("name").GetString()));
        Assert.Equal(["Delta"], rest.GetProperty("items").EnumerateArray().Select(team => team.GetProperty("name").GetString()));
        using var bad = await alice.GetAsync($"{Teams}?limit=1000");
        var problem = await AssertProblemAsync(bad, HttpStatusCode.BadRequest, "validation-failed");
        Assert.Equal("invalid-value", problem.GetProperty("fieldErrors").GetProperty("limit")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Names_are_unique_ignoring_case_and_only_Admins_rename()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var lions = await CreateTeamAsync(alice, "Lions");
        var tigers = await CreateTeamAsync(alice, "Tigers");
        var tigersCode = tigers.GetProperty("code").GetString()!;

        using var duplicate = await PostTeamAsync(alice, " LIONS ");
        var problem = await AssertProblemAsync(duplicate, HttpStatusCode.Conflict, "duplicate-team-name");
        Assert.Equal("LIONS", problem.GetProperty("existingName").GetString());
        using var renameToTaken = await alice.SendJsonAsync(HttpMethod.Put, $"{Teams}/{tigersCode}", new { name = "lions" }, await alice.AntiforgeryTokenAsync());
        await AssertProblemAsync(renameToTaken, HttpStatusCode.Conflict, "duplicate-team-name");

        using var bob = await LoggedInAsync("bob", "Bob");
        using var bobRenames = await bob.SendJsonAsync(HttpMethod.Put, $"{Teams}/{tigersCode}", new { name = "Bobcats" }, await bob.AntiforgeryTokenAsync());
        await AssertProblemAsync(bobRenames, HttpStatusCode.Forbidden, "forbidden");
        using var bobForm = Form(null, Image(10, 10));
        using var bobSetsLogo = await bob.SendFormAsync(HttpMethod.Put, $"{Teams}/{tigersCode}/logo", bobForm, await bob.AntiforgeryTokenAsync());
        await AssertProblemAsync(bobSetsLogo, HttpStatusCode.Forbidden, "forbidden");
        using var bobRemovesLogo = await bob.SendJsonAsync(HttpMethod.Delete, $"{Teams}/{tigersCode}/logo", null, await bob.AntiforgeryTokenAsync());
        await AssertProblemAsync(bobRemovesLogo, HttpStatusCode.Forbidden, "forbidden");

        using var renamed = await alice.SendJsonAsync(HttpMethod.Put, $"{Teams}/{tigersCode}", new { name = "TIGERS United" }, await alice.AntiforgeryTokenAsync());
        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        var body = await JsonAsync(renamed);
        Assert.Equal(("TIGERS United", tigersCode), (body.GetProperty("name").GetString(), body.GetProperty("code").GetString()));
        Assert.Equal("Lions", lions.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Parallel_creations_with_the_same_name_create_one_team()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var token = await alice.AntiforgeryTokenAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(async i =>
        {
            using var form = Form(i % 2 == 0 ? "Lions" : "LIONS ", null);
            return await alice.SendFormAsync(HttpMethod.Post, Teams, form, token);
        }));

        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.Equal(7, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));
        foreach (var response in responses)
        {
            response.Dispose();
        }

        Assert.Equal(1, await CountAsync("SELECT count(*) FROM teams"));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM team_memberships"));
    }

    [Fact]
    public async Task A_code_taken_meanwhile_is_rejected_by_the_database_and_the_team_saved_with_another()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var existing = await CreateTeamAsync(alice, "Lions");
        var takenCode = TeamCode.Parse(existing.GetProperty("code").GetString()!);
        await using var scope = _factory.Services.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<EfTeamRepository>();
        var creator = Guid.NewGuid();
        var clash = Team.Create(Guid.NewGuid(), Name("Tigers"), takenCode, DateTimeOffset.UtcNow, creator);

        await Assert.ThrowsAsync<TeamCodeUniquenessViolationException>(() => repository.AddAsync(clash, TeamMembership.ForCreator(Guid.NewGuid(), clash), null, Cancellation));

        var retry = Team.Create(Guid.NewGuid(), Name("Tigers"), TeamCode.Parse("ZZZZZ9"), DateTimeOffset.UtcNow, creator);
        await repository.AddAsync(retry, TeamMembership.ForCreator(Guid.NewGuid(), retry), null, Cancellation);
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM teams"));
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM team_memberships"));
    }

    [Fact]
    public async Task A_code_of_a_deleted_team_is_never_given_again()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var existing = await CreateTeamAsync(alice, "Lions");
        var code = existing.GetProperty("code").GetString()!;
        await using (var connection = new NpgsqlConnection(_connectionString))
        {
            await connection.OpenAsync(Cancellation);
            await using var command = new NpgsqlCommand("UPDATE teams SET deleted_at = now()", connection);
            await command.ExecuteNonQueryAsync(Cancellation);
        }

        var codes = new QueueCodeGenerator(code, "NEW001");
        await using var factory = _factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services => services.AddSingleton<ITeamCodeGenerator>(codes)));
        using var browser = new TestBrowser(
            factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true, BaseAddress = new Uri("http://localhost") }),
            _factory.IdentityProvider);
        await browser.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice"));

        var team = await CreateTeamAsync(browser, "Lions");

        Assert.Equal("NEW001", team.GetProperty("code").GetString());
        using var deleted = await browser.GetAsync($"{Teams}/{code}");
        await AssertProblemAsync(deleted, HttpStatusCode.NotFound, "team-not-found");
    }

    [Fact]
    public async Task Invalid_input_is_a_validation_problem_and_creates_nothing()
    {
        using var alice = await LoggedInAsync("alice", "Alice");

        using var blank = await PostTeamAsync(alice, "   ");
        using var tooLong = await PostTeamAsync(alice, new string('x', 65));
        using var svg = await PostTeamAsync(alice, "Lions", Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\"/>"), "logo.svg");
        using var noLogoForm = Form(null, null);
        using var putWithoutFile = await alice.SendFormAsync(HttpMethod.Put, $"{Teams}/AAAAAA/logo", noLogoForm, await alice.AntiforgeryTokenAsync());

        Assert.Equal("required", (await AssertProblemAsync(blank, HttpStatusCode.BadRequest, "validation-failed")).GetProperty("fieldErrors").GetProperty("name")[0].GetProperty("code").GetString());
        var tooLongCode = (await AssertProblemAsync(tooLong, HttpStatusCode.BadRequest, "validation-failed")).GetProperty("fieldErrors").GetProperty("name")[0];
        Assert.Equal(("too-long", 64), (tooLongCode.GetProperty("code").GetString(), tooLongCode.GetProperty("maxLength").GetInt32()));
        Assert.Equal("unsupported-image", (await AssertProblemAsync(svg, HttpStatusCode.BadRequest, "validation-failed")).GetProperty("fieldErrors").GetProperty("logo")[0].GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, putWithoutFile.StatusCode);
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM teams"));
    }

    [Fact]
    public async Task An_upload_over_the_limit_is_rejected()
    {
        using var alice = await LoggedInAsync("alice", "Alice");
        var tooLarge = new byte[LogoUpload.MaxBytes + 1];
        Image(10, 10).CopyTo(tooLarge, 0);

        using var response = await PostTeamAsync(alice, "Lions", tooLarge);

        Assert.True(
            response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.RequestEntityTooLarge,
            $"Expected 400 file-too-large or 413, got {(int)response.StatusCode}.");
        if (response.StatusCode == HttpStatusCode.BadRequest)
        {
            var problem = await AssertProblemAsync(response, HttpStatusCode.BadRequest, "validation-failed");
            Assert.Equal("file-too-large", problem.GetProperty("fieldErrors").GetProperty("logo")[0].GetProperty("code").GetString());
        }

        Assert.Equal(0, await CountAsync("SELECT count(*) FROM teams"));
    }

    [Fact]
    public async Task Unknown_teams_are_not_found()
    {
        using var alice = await LoggedInAsync("alice", "Alice");

        using var unknown = await alice.GetAsync($"{Teams}/ZZZZZZ");
        using var malformed = await alice.GetAsync($"{Teams}/no-code");

        await AssertProblemAsync(unknown, HttpStatusCode.NotFound, "team-not-found");
        await AssertProblemAsync(malformed, HttpStatusCode.NotFound, "team-not-found");
    }

    [Fact]
    public async Task Teams_need_a_session_and_changes_the_antiforgery_token()
    {
        using var anonymous = _factory.CreateBrowser();
        using var list = await anonymous.GetAsync(Teams);
        using var mine = await anonymous.GetAsync("/api/me/teams");
        await AssertProblemAsync(list, HttpStatusCode.Unauthorized, "unauthorized");
        await AssertProblemAsync(mine, HttpStatusCode.Unauthorized, "unauthorized");

        using var alice = await LoggedInAsync("alice", "Alice");
        using var form = Form("Lions", null);
        using var withoutToken = await alice.SendFormAsync(HttpMethod.Post, Teams, form, antiforgeryToken: null);
        await AssertProblemAsync(withoutToken, HttpStatusCode.BadRequest, "invalid-antiforgery-token");
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM teams"));
    }

    private static TeamName Name(string text) => TeamName.TryCreate(text, out var name, out _) ? name : throw new ArgumentException(text, nameof(text));

    private sealed class QueueCodeGenerator(params string[] codes) : ITeamCodeGenerator
    {
        private readonly Queue<string> _codes = new(codes);

        public TeamCode NewCode() => TeamCode.Parse(_codes.Dequeue());
    }
}
