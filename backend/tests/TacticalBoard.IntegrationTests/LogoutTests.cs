using System.Net;
using Microsoft.AspNetCore.WebUtilities;
using TacticalBoard.IntegrationTests.TestSupport;

namespace TacticalBoard.IntegrationTests;

public sealed class LogoutTests(PostgresFixture postgres) : IAsyncLifetime
{
    private ApiFactory _factory = null!;

    public ValueTask InitializeAsync()
    {
        _factory = ApiFactory.WithDatabase(postgres.NewDatabaseConnectionString());
        return ValueTask.CompletedTask;
    }

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    [Fact]
    public async Task Logout_ends_the_session_and_continues_at_the_identity_provider()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice");

        using var response = await browser.LogoutAsync(await browser.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!;
        Assert.Equal(FakeIdentityProvider.EndSessionEndpoint.AbsoluteUri, location.GetLeftPart(UriPartial.Path));
        var query = QueryHelpers.ParseQuery(location.Query);
        Assert.Equal("http://localhost/auth/signout-callback", query["post_logout_redirect_uri"].ToString());
        Assert.False(string.IsNullOrEmpty(query["id_token_hint"].ToString()));
        using var me = await browser.GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task The_identity_provider_returns_to_the_start_page()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice");
        using var logout = await browser.LogoutAsync(await browser.AntiforgeryTokenAsync());
        var state = QueryHelpers.ParseQuery(logout.Headers.Location!.Query)["state"].ToString();

        using var back = await browser.GetAsync("/auth/signout-callback?state=" + Uri.EscapeDataString(state));

        Assert.Equal(HttpStatusCode.Redirect, back.StatusCode);
        Assert.Equal("/", back.Headers.Location!.OriginalString);
    }

    [Fact]
    public async Task Logout_stays_local_when_the_identity_provider_has_no_end_session_endpoint()
    {
        _factory.IdentityProvider.SupportsEndSession = false;
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice");

        using var response = await browser.LogoutAsync(await browser.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/", response.Headers.Location!.OriginalString);
        using var me = await browser.GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task Logout_needs_an_antiforgery_token()
    {
        using var browser = _factory.CreateBrowser();
        await browser.LoginSuccessfullyAsync("alice");

        using var response = await browser.LogoutAsync(antiforgeryToken: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        await browser.MeAsync();
    }

    [Fact]
    public async Task Logout_without_a_session_returns_to_the_start_page()
    {
        using var browser = _factory.CreateBrowser();

        using var response = await browser.LogoutAsync(await browser.AntiforgeryTokenAsync());

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/", response.Headers.Location!.OriginalString);
    }
}
