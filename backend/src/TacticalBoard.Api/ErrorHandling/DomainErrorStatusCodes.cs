using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.Api.ErrorHandling;

/// <summary>Maps the transport-neutral <see cref="DomainErrorKind"/> to an HTTP status code.</summary>
public static class DomainErrorStatusCodes
{
    /// <summary>The HTTP status code for <paramref name="kind"/>.</summary>
    public static int For(DomainErrorKind kind) => kind switch
    {
        DomainErrorKind.Validation => StatusCodes.Status400BadRequest,
        DomainErrorKind.NotFound => StatusCodes.Status404NotFound,
        DomainErrorKind.Forbidden => StatusCodes.Status403Forbidden,
        DomainErrorKind.Conflict => StatusCodes.Status409Conflict,
        DomainErrorKind.PreconditionFailed => StatusCodes.Status412PreconditionFailed,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown domain error kind."),
    };
}
