using System.Net;
using Microsoft.AspNetCore.WebUtilities;
using TacticalBoard.IntegrationTests.TestSupport;

namespace TacticalBoard.IntegrationTests;

/// <summary>The BFF login (arc42 ch. 8.13) end to end against an in-memory OIDC provider and real PostgreSQL.</summary>
public sealed class LoginTests(PostgresFixture postgres) : IAsyncLifetime
{
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

    [Fact]
    public async Task Login_redirects_to_the_identity_provider_with_code_flow_and_pkce()
    {
        using var browser = _factory.CreateBrowser();

        using var response = await browser.GetAsync("/auth/login?returnUrl=%2Feditor");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!;
        Assert.Equal(FakeIdentityProvider.AuthorizationEndpoint.AbsoluteUri, location.GetLeftPart(UriPartial.Path));
        var query = QueryHelpers.ParseQuery(location.Query);
        Assert.Equal("code", query["response_type"].ToString());
        // Query is the default response mode of the code flow, so the parameter may be left out.
        Assert.True(!query.TryGetValue("response_mode", out var mode) || mode == "query");
        Assert.Equal("S256", query["code_challenge_method"].ToString());
        Assert.False(string.IsNullOrEmpty(query["code_challenge"].ToString()));
        Assert.Equal("openid profile email", query["scope"].ToString());
        Assert.Equal("http://localhost/auth/callback", query["redirect_uri"].ToString());
    }

    [Fact]
    public async Task A_first_login_creates_the_user_and_starts_a_session()
    {
        using var browser = _factory.CreateBrowser();

        using var callback = await browser.LoginAsync("alice", TestClaims.Profile("Alice Example", "alice", "alice@example.org"), "/editor");

        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        Assert.Equal("/editor", callback.Headers.Location!.OriginalString);
        var sessionCookie = callback.Headers.GetValues("Set-Cookie").Single(cookie => cookie.StartsWith("tb_session=", StringComparison.Ordinal));
        Assert.Contains("httponly", sessionCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", sessionCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", sessionCookie, StringComparison.OrdinalIgnoreCase);

        var me = await browser.MeAsync();
        Assert.Equal("Alice Example", me.GetProperty("displayName").GetString());
        Assert.False(me.GetProperty("isSystemAdministrator").GetBoolean());
        Assert.True(Guid.TryParse(me.GetProperty("id").GetString(), out _));
        Assert.Equal(1, await UserRows.CountAsync(_connectionString));
    }

    [Fact]
    public async Task The_display_name_falls_back_to_preferred_username_and_email()
    {
        using var first = _factory.CreateBrowser();
        await first.LoginSuccessfullyAsync("bob", TestClaims.Profile(preferredUsername: "bobby", email: "bob@example.org"));
        using var second = _factory.CreateBrowser();
        await second.LoginSuccessfullyAsync("carol", TestClaims.Profile(email: "carol@example.org"));

        Assert.Equal("bobby", (await first.MeAsync()).GetProperty("displayName").GetString());
        Assert.Equal("carol@example.org", (await second.MeAsync()).GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task Profile_claims_from_the_userinfo_endpoint_are_used_too()
    {
        _factory.IdentityProvider.ProfileClaimsInUserInfoOnly = true;
        using var browser = _factory.CreateBrowser();

        await browser.LoginSuccessfullyAsync("dave", TestClaims.Profile(preferredUsername: "davey"));

        Assert.Equal("davey", (await browser.MeAsync()).GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task A_later_login_finds_the_same_user_and_keeps_the_changed_name()
    {
        using var first = _factory.CreateBrowser();
        await first.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice"));
        var id = (await first.MeAsync()).GetProperty("id").GetString();
        using (var changed = await first.ChangeDisplayNameAsync(new { displayName = "Coach" }, await first.AntiforgeryTokenAsync()))
        {
            Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        }

        using var second = _factory.CreateBrowser();
        await second.LoginSuccessfullyAsync("alice", TestClaims.Profile("Alice Renamed At The IdP"));

        var me = await second.MeAsync();
        Assert.Equal(id, me.GetProperty("id").GetString());
        Assert.Equal("Coach", me.GetProperty("displayName").GetString());
        Assert.Equal(1, await UserRows.CountAsync(_connectionString));
    }

    [Theory]
    [InlineData("https://evil.example.org/")]
    [InlineData("//evil.example.org")]
    public async Task A_foreign_return_url_ends_on_the_start_page(string returnUrl)
    {
        using var browser = _factory.CreateBrowser();

        using var callback = await browser.LoginAsync("alice", returnUrl: returnUrl);

        Assert.Equal("/", callback.Headers.Location!.OriginalString);
    }

    [Fact]
    public async Task Login_while_logged_in_skips_the_identity_provider()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice");

        using var response = await browser.GetAsync("/auth/login?returnUrl=%2Feditor");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/editor", response.Headers.Location!.OriginalString);
    }

    [Fact]
    public async Task A_configured_identity_becomes_system_administrator()
    {
        using var browser = _factory.CreateBrowser();

        await browser.LoginSuccessfullyAsync("boss");

        Assert.True((await browser.MeAsync()).GetProperty("isSystemAdministrator").GetBoolean());
    }

    [Fact]
    public async Task A_revoked_bootstrap_administrator_gets_the_role_back_only_when_none_is_left()
    {
        using (var boss = _factory.CreateBrowser())
        {
            await boss.LoginSuccessfullyAsync("boss");
        }

        await UserRows.RevokeSystemAdministratorAsync(_connectionString, "boss");
        using var again = _factory.CreateBrowser();
        await again.LoginSuccessfullyAsync("boss");

        Assert.True((await again.MeAsync()).GetProperty("isSystemAdministrator").GetBoolean());
    }

    [Fact]
    public async Task A_blocked_user_gets_no_session()
    {
        using (var first = _factory.CreateBrowser())
        {
            await first.LoginSuccessfullyAsync("alice");
        }

        await UserRows.BlockAsync(_connectionString, "alice");
        using var browser = _factory.CreateBrowser();
        using var callback = await browser.LoginAsync("alice");

        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        Assert.Equal("/?login=failed", callback.Headers.Location!.OriginalString);
        Assert.DoesNotContain(callback.Headers.TryGetValues("Set-Cookie", out var cookies) ? cookies : [], cookie => cookie.StartsWith("tb_session=", StringComparison.Ordinal) && !cookie.Contains("expires=Thu, 01 Jan 1970", StringComparison.OrdinalIgnoreCase));
        using var me = await browser.GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task A_deleted_user_gets_no_session_and_no_new_account()
    {
        using (var first = _factory.CreateBrowser())
        {
            await first.LoginSuccessfullyAsync("alice");
        }

        await UserRows.DeleteAsync(_connectionString, "alice");
        using var browser = _factory.CreateBrowser();
        using var callback = await browser.LoginAsync("alice");

        Assert.Equal("/?login=failed", callback.Headers.Location!.OriginalString);
        Assert.Equal(1, await UserRows.CountAsync(_connectionString));
    }

    [Fact]
    public async Task Blocking_ends_an_existing_session_with_the_next_request()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice");
        await browser.MeAsync();

        await UserRows.BlockAsync(_connectionString, "alice");
        using var blocked = await browser.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, blocked.StatusCode);
        Assert.Contains(blocked.Headers.GetValues("Set-Cookie"), cookie => cookie.StartsWith("tb_session=;", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Deleting_ends_an_existing_session_with_the_next_request()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice");

        await UserRows.DeleteAsync(_connectionString, "alice");
        using var deleted = await browser.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, deleted.StatusCode);
    }

    [Fact]
    public async Task A_forged_callback_does_not_log_in()
    {
        using var browser = _factory.CreateBrowser();

        using var callback = await browser.GetAsync("/auth/callback?code=forged&state=forged");

        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        Assert.Equal("/?login=failed", callback.Headers.Location!.OriginalString);
        Assert.Equal(0, await UserRows.CountAsync(_connectionString));
    }

    [Fact]
    public async Task The_session_survives_a_restart_thanks_to_the_persisted_keys()
    {
        var keys = ApiFactory.NewKeysDirectory();
        var settings = new Dictionary<string, string?> { ["DataProtection:KeysDirectory"] = keys };
        try
        {
            string sessionCookie;
            await using (var before = ApiFactory.WithDatabase(_connectionString, settings: settings))
            {
                using var browser = before.CreateBrowser();
                using var callback = await browser.LoginAsync("alice");
                sessionCookie = callback.Headers.GetValues("Set-Cookie").Single(cookie => cookie.StartsWith("tb_session=", StringComparison.Ordinal)).Split(';')[0];
            }

            Assert.NotEmpty(Directory.GetFiles(keys, "key-*.xml"));
            await using var after = ApiFactory.WithDatabase(_connectionString, settings: settings);
            using var client = after.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/api/me", UriKind.Relative));
            request.Headers.Add("Cookie", sessionCookie);

            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        finally
        {
            Directory.Delete(keys, recursive: true);
        }
    }
}
