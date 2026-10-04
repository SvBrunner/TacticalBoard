using Microsoft.AspNetCore.Http;

namespace TacticalBoard.Api.Authentication;

/// <summary>The session and antiforgery cookies (configuration section <c>Session</c>, e.g. <c>Session__SecureCookies</c>).</summary>
public sealed class SessionSettings
{
    /// <summary>The configuration section.</summary>
    public const string SectionName = "Session";

    /// <summary>
    /// Whether the cookies are marked <c>Secure</c> (sent over HTTPS only). Default <c>true</c>;
    /// set to <c>false</c> only for local development over plain http.
    /// </summary>
    public bool SecureCookies { get; set; } = true;

    /// <summary>The cookie security policy that follows from <see cref="SecureCookies"/>.</summary>
    public CookieSecurePolicy SecurePolicy => SecureCookies ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;

    /// <summary>
    /// A cookie name: with secure cookies it gets the <c>__Host-</c> prefix (browsers then only
    /// accept it as Secure, host-only, path <c>/</c>), otherwise the plain name.
    /// </summary>
    public string CookieName(string baseName) => SecureCookies ? "__Host-" + baseName : baseName;
}
