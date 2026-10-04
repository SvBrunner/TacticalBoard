using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using TacticalBoard.Api.Authentication;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>Records sign-ins and sign-outs instead of writing cookies.</summary>
internal sealed class RecordingAuthenticationService : IAuthenticationService
{
    public List<string?> SignedOut { get; } = [];

    public Task<AuthenticateResult> AuthenticateAsync(HttpContext context, string? scheme) => Task.FromResult(AuthenticateResult.NoResult());

    public Task ChallengeAsync(HttpContext context, string? scheme, AuthenticationProperties? properties) => Task.CompletedTask;

    public Task ForbidAsync(HttpContext context, string? scheme, AuthenticationProperties? properties) => Task.CompletedTask;

    public Task SignInAsync(HttpContext context, string? scheme, ClaimsPrincipal principal, AuthenticationProperties? properties) => Task.CompletedTask;

    public Task SignOutAsync(HttpContext context, string? scheme, AuthenticationProperties? properties)
    {
        SignedOut.Add(scheme);
        return Task.CompletedTask;
    }
}

/// <summary>An <see cref="IUserAuthentication"/> with scripted answers.</summary>
internal sealed class FakeUserAuthentication : IUserAuthentication
{
    public UserSignInResult SignInResult { get; set; } = UserSignInResult.Success(Guid.Parse("0199a6d0-0000-7000-8000-000000000001"));

    public HashSet<Guid> ActiveUsers { get; } = [];

    public List<ExternalLogin> SignIns { get; } = [];

    public List<Guid> Resumed { get; } = [];

    public Task<UserSignInResult> SignInAsync(ExternalLogin login, CancellationToken cancellationToken)
    {
        SignIns.Add(login);
        return Task.FromResult(SignInResult);
    }

    public Task<bool> ResumeSessionAsync(Guid userId, CancellationToken cancellationToken)
    {
        Resumed.Add(userId);
        return Task.FromResult(ActiveUsers.Contains(userId));
    }
}

/// <summary>An <see cref="IAntiforgery"/> that accepts exactly one token in the header.</summary>
internal sealed class FakeAntiforgery : IAntiforgery
{
    public const string ValidToken = "valid-token";

    public AntiforgeryTokenSet GetAndStoreTokens(HttpContext httpContext) => new(ValidToken, "cookie-token", "__RequestVerificationToken", "X-CSRF-TOKEN");

    public AntiforgeryTokenSet GetTokens(HttpContext httpContext) => GetAndStoreTokens(httpContext);

    public Task<bool> IsRequestValidAsync(HttpContext httpContext) =>
        Task.FromResult(httpContext.Request.Headers[AntiforgeryEndpoint.HeaderName] == ValidToken);

    public Task ValidateRequestAsync(HttpContext httpContext) => Task.CompletedTask;

    public void SetCookieTokenAndHeader(HttpContext httpContext)
    {
    }
}

/// <summary>An <see cref="IEndSessionSupport"/> with a fixed answer.</summary>
internal sealed class FixedEndSessionSupport(bool supported) : IEndSessionSupport
{
    public Task<bool> IsSupportedAsync(CancellationToken cancellationToken) => Task.FromResult(supported);
}
