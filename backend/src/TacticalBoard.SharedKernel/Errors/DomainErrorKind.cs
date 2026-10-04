namespace TacticalBoard.SharedKernel.Errors;

/// <summary>
/// The transport-neutral category of a domain error. The API translates it into an
/// HTTP status code; the domain never knows about HTTP (ADR-010).
/// </summary>
public enum DomainErrorKind
{
    /// <summary>The request breaks a rule about the data it carries.</summary>
    Validation,

    /// <summary>The requested item does not exist (or is soft-deleted).</summary>
    NotFound,

    /// <summary>The current user may not do this.</summary>
    Forbidden,

    /// <summary>The request conflicts with the current state (e.g. a duplicate name).</summary>
    Conflict,

    /// <summary>The item changed since the client last read it (optimistic concurrency).</summary>
    PreconditionFailed,
}
