namespace TacticalBoard.Api.Authentication;

/// <summary>Whether the identity provider offers RP-initiated logout (an <c>end_session_endpoint</c>).</summary>
public interface IEndSessionSupport
{
    /// <summary><c>true</c> when the logout should continue at the IdP.</summary>
    Task<bool> IsSupportedAsync(CancellationToken cancellationToken);
}
