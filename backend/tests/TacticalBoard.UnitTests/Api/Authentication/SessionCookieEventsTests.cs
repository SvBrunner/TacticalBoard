using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Api.Authentication;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Api.Authentication;

public class SessionCookieEventsTests
{
    private static readonly Guid UserId = Guid.Parse("0199a6d0-0000-7000-8000-000000000001");
    private static readonly AuthenticationScheme Scheme = new(CookieAuthenticationDefaults.AuthenticationScheme, null, typeof(CookieAuthenticationHandler));

    private readonly FakeUserAuthentication _users = new();
    private readonly RecordingAuthenticationService _authentication = new();

    private DefaultHttpContext HttpContext() =>
        new() { RequestServices = new ServiceCollection().AddSingleton<IAuthenticationService>(_authentication).BuildServiceProvider() };

    private CookieValidatePrincipalContext ValidateContext(System.Security.Claims.ClaimsPrincipal principal) =>
        new(HttpContext(), Scheme, new CookieAuthenticationOptions(), new AuthenticationTicket(principal, Scheme.Name));

    [Fact]
    public async Task Keeps_the_session_of_an_active_user()
    {
        _users.ActiveUsers.Add(UserId);
        var context = ValidateContext(SessionClaims.CreatePrincipal(UserId));

        await new SessionCookieEvents(_users).ValidatePrincipal(context);

        Assert.NotNull(context.Principal);
        Assert.Equal([UserId], _users.Resumed);
        Assert.Empty(_authentication.SignedOut);
    }

    [Fact]
    public async Task Ends_the_session_of_a_blocked_deleted_or_unknown_user()
    {
        var context = ValidateContext(SessionClaims.CreatePrincipal(UserId));

        await new SessionCookieEvents(_users).ValidatePrincipal(context);

        Assert.Null(context.Principal);
        Assert.Equal([CookieAuthenticationDefaults.AuthenticationScheme], _authentication.SignedOut);
    }

    [Fact]
    public async Task Ends_a_session_without_a_user_id()
    {
        var context = ValidateContext(new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity("x")));

        await new SessionCookieEvents(_users).ValidatePrincipal(context);

        Assert.Null(context.Principal);
        Assert.Empty(_users.Resumed);
        Assert.Single(_authentication.SignedOut);
    }

    [Fact]
    public async Task Answers_401_instead_of_redirecting_to_a_login_page()
    {
        var httpContext = HttpContext();
        var context = new RedirectContext<CookieAuthenticationOptions>(httpContext, Scheme, new CookieAuthenticationOptions(), new AuthenticationProperties(), "/login");

        await new SessionCookieEvents(_users).RedirectToLogin(context);

        Assert.Equal(StatusCodes.Status401Unauthorized, httpContext.Response.StatusCode);
        Assert.False(httpContext.Response.Headers.ContainsKey("Location"));
    }

    [Fact]
    public async Task Answers_403_instead_of_redirecting_to_an_access_denied_page()
    {
        var httpContext = HttpContext();
        var context = new RedirectContext<CookieAuthenticationOptions>(httpContext, Scheme, new CookieAuthenticationOptions(), new AuthenticationProperties(), "/denied");

        await new SessionCookieEvents(_users).RedirectToAccessDenied(context);

        Assert.Equal(StatusCodes.Status403Forbidden, httpContext.Response.StatusCode);
        Assert.False(httpContext.Response.Headers.ContainsKey("Location"));
    }
}
