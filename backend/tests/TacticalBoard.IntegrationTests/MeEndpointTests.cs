using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TacticalBoard.IntegrationTests.TestSupport;

namespace TacticalBoard.IntegrationTests;

/// <summary><c>/api/me</c>, the 401 behavior and the CSRF protection through the real pipeline.</summary>
public sealed class MeEndpointTests(PostgresFixture postgres) : IAsyncLifetime
{
    private ApiFactory _factory = null!;

    public ValueTask InitializeAsync()
    {
        _factory = ApiFactory.WithDatabase(postgres.NewDatabaseConnectionString());
        return ValueTask.CompletedTask;
    }

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    private static async Task<JsonElement> ProblemAsync(HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        return await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Me_without_a_session_is_a_401_problem_not_a_redirect()
    {
        using var browser = _factory.CreateBrowser();

        using var response = await browser.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
        var problem = await ProblemAsync(response);
        Assert.Equal("https://tacticalboard/errors/unauthorized", problem.GetProperty("type").GetString());
        Assert.Equal("/api/me", problem.GetProperty("instance").GetString());
    }

    [Fact]
    public async Task Me_with_an_invalid_cookie_is_a_401()
    {
        using var browser = _factory.CreateBrowser();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/api/me", UriKind.Relative));
        request.Headers.Add("Cookie", "tb_session=garbage");

        using var response = await browser.Client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Changing_the_display_name_without_a_session_is_a_401()
    {
        using var browser = _factory.CreateBrowser();

        using var response = await browser.ChangeDisplayNameAsync(new { displayName = "Coach" }, await browser.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Changes_the_display_name_trimmed()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice"));

        using var response = await browser.ChangeDisplayNameAsync(new { displayName = "  Coach Alice  " }, await browser.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        Assert.Equal("Coach Alice", body.GetProperty("displayName").GetString());
        Assert.Equal("Coach Alice", (await browser.MeAsync()).GetProperty("displayName").GetString());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901")]
    public async Task Rejects_an_invalid_display_name_as_a_validation_problem(string displayName)
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice"));

        using var response = await browser.ChangeDisplayNameAsync(new { displayName }, await browser.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ProblemAsync(response);
        Assert.Equal("https://tacticalboard/errors/validation-failed", problem.GetProperty("type").GetString());
        Assert.Equal(JsonValueKind.Array, problem.GetProperty("errors").GetProperty("displayName").ValueKind);
        var code = problem.GetProperty("fieldErrors").GetProperty("displayName")[0].GetProperty("code").GetString();
        Assert.True(code is "required" or "too-long", code);
        Assert.Equal("Alice", (await browser.MeAsync()).GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task A_new_user_has_no_language_until_they_choose_one_and_it_survives_a_new_login()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice"));
        Assert.Equal(JsonValueKind.Null, (await browser.MeAsync()).GetProperty("preferredLanguage").ValueKind);

        using var response = await browser.SendJsonAsync(HttpMethod.Put, "/api/me/language", new { language = "de-CH" }, await browser.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        Assert.Equal("de-ch", body.GetProperty("preferredLanguage").GetString());
        using var again = _factory.CreateBrowser();
        await again.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice"));
        Assert.Equal("de-ch", (await again.MeAsync()).GetProperty("preferredLanguage").GetString());
    }

    [Fact]
    public async Task Rejects_an_invalid_language_with_a_stable_code()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice"));

        using var response = await browser.SendJsonAsync(HttpMethod.Put, "/api/me/language", new { language = "Deutsch!" }, await browser.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ProblemAsync(response);
        Assert.Equal("https://tacticalboard/errors/validation-failed", problem.GetProperty("type").GetString());
        Assert.Equal("unsupported-language", problem.GetProperty("fieldErrors").GetProperty("language")[0].GetProperty("code").GetString());
        Assert.Equal(JsonValueKind.Null, (await browser.MeAsync()).GetProperty("preferredLanguage").ValueKind);
    }

    [Fact]
    public async Task Changing_the_language_needs_a_session()
    {
        using var browser = _factory.CreateBrowser();

        using var response = await browser.SendJsonAsync(HttpMethod.Put, "/api/me/language", new { language = "de" }, await browser.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Rejects_a_missing_display_name()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice");

        using var response = await browser.ChangeDisplayNameAsync(new { }, await browser.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Changing_the_display_name_needs_an_antiforgery_token()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice"));

        using var response = await browser.ChangeDisplayNameAsync(new { displayName = "Forged" }, antiforgeryToken: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ProblemAsync(response);
        Assert.Equal("https://tacticalboard/errors/invalid-antiforgery-token", problem.GetProperty("type").GetString());
        Assert.Equal("Alice", (await browser.MeAsync()).GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task A_token_from_before_the_login_is_not_valid_for_the_session()
    {
        using var browser = _factory.CreateBrowser();
        var anonymousToken = await browser.AntiforgeryTokenAsync();
        await browser.LoginSuccessfullyAsync("alice");

        using var response = await browser.ChangeDisplayNameAsync(new { displayName = "Coach" }, anonymousToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_token_of_another_browser_is_not_valid()
    {
        using var attacker = _factory.CreateBrowser();
        await attacker.LoginSuccessfullyAsync("mallory");
        var attackerToken = await attacker.AntiforgeryTokenAsync();
        using var victim = _factory.CreateBrowser();
        await victim.LoginSuccessfullyAsync("alice");

        using var response = await victim.ChangeDisplayNameAsync(new { displayName = "Pwned" }, attackerToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task The_antiforgery_endpoint_issues_an_uncached_token_and_cookie()
    {
        using var browser = _factory.CreateBrowser();

        using var response = await browser.GetAsync("/api/antiforgery");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        Assert.False(string.IsNullOrEmpty(body.GetProperty("token").GetString()));
        Assert.Equal("X-CSRF-TOKEN", body.GetProperty("headerName").GetString());
        Assert.Equal("__RequestVerificationToken", body.GetProperty("formFieldName").GetString());
        Assert.Contains("no-store", response.Headers.CacheControl?.ToString() ?? string.Empty, StringComparison.Ordinal);
        var cookie = response.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("tb_antiforgery=", StringComparison.Ordinal));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
    }
}
