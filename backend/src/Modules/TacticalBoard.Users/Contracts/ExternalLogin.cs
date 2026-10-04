namespace TacticalBoard.Users.Contracts;

/// <summary>
/// A successful login at the identity provider, as the host's OIDC handler saw it: the identity
/// (issuer + subject) and the claims the initial display name is taken from.
/// </summary>
/// <param name="Issuer">The IdP's issuer (<c>iss</c>).</param>
/// <param name="Subject">The subject (<c>sub</c>).</param>
/// <param name="Name">The <c>name</c> claim, if any.</param>
/// <param name="PreferredUsername">The <c>preferred_username</c> claim, if any.</param>
/// <param name="Email">The <c>email</c> claim, if any.</param>
public sealed record ExternalLogin(string Issuer, string Subject, string? Name, string? PreferredUsername, string? Email);
