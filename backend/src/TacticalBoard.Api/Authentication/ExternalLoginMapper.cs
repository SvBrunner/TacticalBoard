using System.Security.Claims;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Api.Authentication;

/// <summary>
/// Turns the principal the OIDC handler built (ID token + userinfo claims, unmapped claim names)
/// into an <see cref="ExternalLogin"/>. Uses only standard OIDC claims.
/// </summary>
public static class ExternalLoginMapper
{
    /// <summary>The login, or <c>null</c> when the principal lacks a subject or an issuer.</summary>
    public static ExternalLogin? Map(ClaimsPrincipal principal)
    {
        ArgumentNullException.ThrowIfNull(principal);
        var subject = principal.FindFirst("sub");
        if (subject is null || string.IsNullOrWhiteSpace(subject.Value))
        {
            return null;
        }

        // The "iss" claim is kept (the handler would drop it by default); the subject claim's
        // issuer is the same value, taken from the validated ID token.
        var issuer = Value(principal, "iss") ?? subject.Issuer;
        if (string.IsNullOrWhiteSpace(issuer) || issuer == ClaimsIdentity.DefaultIssuer)
        {
            return null;
        }

        return new ExternalLogin(issuer, subject.Value, Value(principal, "name"), Value(principal, "preferred_username"), Value(principal, "email"));
    }

    private static string? Value(ClaimsPrincipal principal, string type)
    {
        var value = principal.FindFirst(type)?.Value;
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }
}
