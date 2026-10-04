using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using TacticalBoard.Api.Authentication;
using TacticalBoard.Api.Configuration;
using TacticalBoard.Users.Contracts;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Api.Authentication;

public class OidcEventsTests
{
    private const string Issuer = "https://idp.example.org/realms/x";
    private static readonly Guid UserId = Guid.Parse("0199a6d0-0000-7000-8000-000000000001");
    private static readonly AuthenticationScheme Scheme = new(OpenIdConnectDefaults.AuthenticationScheme, null, typeof(OpenIdConnectHandler));

    private readonly FakeUserAuthentication _users = new();

    private static OpenIdConnectOptions Options() => new()
    {
        CallbackPath = AuthPaths.Callback,
        SignedOutCallbackPath = AuthPaths.SignedOutCallback,
    };

    private OidcEvents Events(string? publicBaseUrl = "https://tb.example.org") =>
        new(
            _users,
            new PublicUrls(Microsoft.Extensions.Options.Options.Create(new AppOptions { PublicBaseUrl = publicBaseUrl is null ? null : new Uri(publicBaseUrl) })),
            NullLogger<OidcEvents>.Instance);

    private static ClaimsPrincipal IdpPrincipal(params (string Type, string Value)[] claims) =>
        new(new ClaimsIdentity(claims.Select(claim => new Claim(claim.Type, claim.Value, ClaimValueTypes.String, Issuer)), "oidc"));

    private static TicketReceivedContext TicketContext(ClaimsPrincipal principal, AuthenticationProperties properties) =>
        new(new DefaultHttpContext(), Scheme, Options(), new AuthenticationTicket(principal, properties, Scheme.Name));

    [Fact]
    public async Task Sends_the_public_callback_url_as_redirect_uri()
    {
        var context = new RedirectContext(new DefaultHttpContext(), Scheme, Options(), new AuthenticationProperties())
        {
            ProtocolMessage = new OpenIdConnectMessage { RedirectUri = "http://internal:8080/auth/callback" },
        };

        await Events().RedirectToIdentityProvider(context);

        Assert.Equal("https://tb.example.org/auth/callback", context.ProtocolMessage.RedirectUri);
    }

    [Fact]
    public async Task Keeps_the_request_based_redirect_uri_without_a_public_base_url()
    {
        var context = new RedirectContext(new DefaultHttpContext(), Scheme, Options(), new AuthenticationProperties())
        {
            ProtocolMessage = new OpenIdConnectMessage { RedirectUri = "http://localhost:5080/auth/callback" },
        };

        await Events(publicBaseUrl: null).RedirectToIdentityProvider(context);

        Assert.Equal("http://localhost:5080/auth/callback", context.ProtocolMessage.RedirectUri);
    }

    [Fact]
    public async Task Sends_the_public_signed_out_callback_as_post_logout_redirect_uri()
    {
        var context = new RedirectContext(new DefaultHttpContext(), Scheme, Options(), new AuthenticationProperties())
        {
            ProtocolMessage = new OpenIdConnectMessage { PostLogoutRedirectUri = "http://internal/auth/signout-callback" },
        };

        await Events().RedirectToIdentityProviderForSignOut(context);

        Assert.Equal("https://tb.example.org/auth/signout-callback", context.ProtocolMessage.PostLogoutRedirectUri);
    }

    [Fact]
    public async Task Keeps_the_post_logout_redirect_uri_without_a_public_base_url()
    {
        var context = new RedirectContext(new DefaultHttpContext(), Scheme, Options(), new AuthenticationProperties())
        {
            ProtocolMessage = new OpenIdConnectMessage { PostLogoutRedirectUri = "http://localhost/auth/signout-callback" },
        };

        await Events(publicBaseUrl: null).RedirectToIdentityProviderForSignOut(context);

        Assert.Equal("http://localhost/auth/signout-callback", context.ProtocolMessage.PostLogoutRedirectUri);
    }

    [Fact]
    public async Task Signs_in_the_local_user_and_keeps_only_its_id_and_the_id_token()
    {
        var properties = new AuthenticationProperties();
        properties.StoreTokens(
        [
            new AuthenticationToken { Name = "id_token", Value = "the-id-token" },
            new AuthenticationToken { Name = "access_token", Value = "the-access-token" },
            new AuthenticationToken { Name = "refresh_token", Value = "the-refresh-token" },
        ]);
        var context = TicketContext(IdpPrincipal(("iss", Issuer), ("sub", "abc"), ("name", "Test Trainer"), ("email", "t@example.org")), properties);

        await Events().TicketReceived(context);

        Assert.Equal([new ExternalLogin(Issuer, "abc", "Test Trainer", null, "t@example.org")], _users.SignIns);
        Assert.Equal(UserId, SessionClaims.UserId(context.Principal));
        Assert.Single(context.Principal!.Claims);
        Assert.Equal(["id_token"], properties.GetTokens().Select(token => token.Name));
        Assert.Equal("the-id-token", properties.GetTokenValue("id_token"));
        Assert.Null(context.Result);
    }

    [Fact]
    public async Task Stores_no_tokens_without_an_id_token()
    {
        var properties = new AuthenticationProperties();
        properties.StoreTokens([new AuthenticationToken { Name = "access_token", Value = "a" }]);
        var context = TicketContext(IdpPrincipal(("iss", Issuer), ("sub", "abc")), properties);

        await Events().TicketReceived(context);

        Assert.Empty(properties.GetTokens());
    }

    [Theory]
    [InlineData(SignInRejection.Blocked)]
    [InlineData(SignInRejection.Deleted)]
    [InlineData(SignInRejection.InvalidIdentity)]
    public async Task Gives_a_rejected_user_no_session(SignInRejection rejection)
    {
        _users.SignInResult = UserSignInResult.Rejected(rejection);
        var context = TicketContext(IdpPrincipal(("iss", Issuer), ("sub", "abc")), new AuthenticationProperties());

        await Events().TicketReceived(context);

        Assert.True(context.Result!.Handled);
        Assert.Equal(StatusCodes.Status302Found, context.Response.StatusCode);
        Assert.Equal(AuthPaths.LoginFailedRedirect, context.Response.Headers.Location.ToString());
    }

    [Fact]
    public async Task Gives_a_login_without_subject_no_session()
    {
        var context = TicketContext(IdpPrincipal(("iss", Issuer)), new AuthenticationProperties());

        await Events().TicketReceived(context);

        Assert.Empty(_users.SignIns);
        Assert.True(context.Result!.Handled);
        Assert.Equal(AuthPaths.LoginFailedRedirect, context.Response.Headers.Location.ToString());
    }

    [Fact]
    public async Task Turns_a_remote_failure_into_a_quiet_redirect()
    {
        var context = new RemoteFailureContext(new DefaultHttpContext(), Scheme, Options(), new InvalidOperationException("Correlation failed."));

        await Events().RemoteFailure(context);

        Assert.True(context.Result!.Handled);
        Assert.Equal(AuthPaths.LoginFailedRedirect, context.Response.Headers.Location.ToString());
    }
}
