using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Api.Authentication;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Api.Authentication;

public class AuthEndpointsTests
{
    private readonly RecordingAuthenticationService _authentication = new();

    private DefaultHttpContext Anonymous() =>
        new() { RequestServices = new ServiceCollection().AddSingleton<IAuthenticationService>(_authentication).BuildServiceProvider() };

    private DefaultHttpContext LoggedIn()
    {
        var context = Anonymous();
        context.User = SessionClaims.CreatePrincipal(Guid.NewGuid());
        return context;
    }

    [Fact]
    public void Login_challenges_the_identity_provider_with_the_return_url()
    {
        var result = AuthEndpoints.Login(Anonymous(), "/editor");

        var challenge = Assert.IsType<ChallengeHttpResult>(result);
        Assert.Equal([OpenIdConnectDefaults.AuthenticationScheme], challenge.AuthenticationSchemes);
        Assert.Equal("/editor", challenge.Properties!.RedirectUri);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("https://evil.example.org")]
    [InlineData("//evil.example.org")]
    public void Login_returns_to_the_start_page_for_a_missing_or_foreign_return_url(string? returnUrl)
    {
        var challenge = Assert.IsType<ChallengeHttpResult>(AuthEndpoints.Login(Anonymous(), returnUrl));

        Assert.Equal("/", challenge.Properties!.RedirectUri);
    }

    [Fact]
    public void Login_while_logged_in_goes_straight_to_the_return_url()
    {
        var redirect = Assert.IsType<RedirectHttpResult>(AuthEndpoints.Login(LoggedIn(), "/editor"));

        Assert.Equal("/editor", redirect.Url);
    }

    [Fact]
    public async Task Logout_continues_at_the_identity_provider_when_it_supports_it()
    {
        var result = await AuthEndpoints.LogoutAsync(LoggedIn(), new FixedEndSessionSupport(true));

        var signOut = Assert.IsType<SignOutHttpResult>(result);
        Assert.Equal(
            [CookieAuthenticationDefaults.AuthenticationScheme, OpenIdConnectDefaults.AuthenticationScheme],
            signOut.AuthenticationSchemes);
        Assert.Equal("/", signOut.Properties!.RedirectUri);
    }

    [Fact]
    public async Task Logout_ends_only_the_local_session_when_the_identity_provider_cannot_end_its_own()
    {
        var result = await AuthEndpoints.LogoutAsync(LoggedIn(), new FixedEndSessionSupport(false));

        Assert.Equal("/", Assert.IsType<RedirectHttpResult>(result).Url);
        Assert.Equal([CookieAuthenticationDefaults.AuthenticationScheme], _authentication.SignedOut);
    }

    [Fact]
    public async Task Logout_without_a_session_just_returns_to_the_start_page()
    {
        var result = await AuthEndpoints.LogoutAsync(Anonymous(), new FixedEndSessionSupport(true));

        Assert.Equal("/", Assert.IsType<RedirectHttpResult>(result).Url);
        Assert.Empty(_authentication.SignedOut);
    }

    [Fact]
    public async Task Maps_login_and_logout_under_auth()
    {
        await using var app = WebApplication.CreateBuilder().Build();

        app.MapAuthEndpoints();

        var endpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>()
            .Select(endpoint => endpoint.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods.Single() + " " + endpoint.RoutePattern.RawText);
        Assert.Equal(["GET /auth/login", "POST /auth/logout"], endpoints);
    }
}
