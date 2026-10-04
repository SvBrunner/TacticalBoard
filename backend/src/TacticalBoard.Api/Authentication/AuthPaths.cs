namespace TacticalBoard.Api.Authentication;

/// <summary>The fixed paths of the login (arc42 ch. 8.13). The reverse proxy forwards <c>/auth</c> to the backend.</summary>
public static class AuthPaths
{
    /// <summary><c>GET /auth/login?returnUrl=…</c> starts the login.</summary>
    public const string Login = "/auth/login";

    /// <summary>The IdP redirects here with the authorization code (the OIDC redirect URI).</summary>
    public const string Callback = "/auth/callback";

    /// <summary><c>POST /auth/logout</c> ends the session.</summary>
    public const string Logout = "/auth/logout";

    /// <summary>The IdP redirects here after its own logout (the post-logout redirect URI).</summary>
    public const string SignedOutCallback = "/auth/signout-callback";

    /// <summary>Where the browser lands after a failed or rejected login; the frontend shows a short notice ("Login failed.").</summary>
    public const string LoginFailedRedirect = "/?login=failed";

    /// <summary>Where a blocked user lands after logging in at the IdP; the frontend shows "Account blocked.".</summary>
    public const string LoginBlockedRedirect = "/?login=blocked";

    /// <summary>The start page, the default target after login and logout.</summary>
    public const string Home = "/";
}
