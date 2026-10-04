namespace TacticalBoard.SharedKernel.Errors;

/// <summary>
/// Base class of every expected, business-level error. Each concrete error has a stable
/// <see cref="Code"/> (kebab-case, e.g. <c>duplicate-title</c>) that the API turns into the
/// Problem Details <c>type</c> URI, so clients can react to it (arc42 ch. 8.2).
/// </summary>
public abstract class DomainException : Exception
{
    protected DomainException(DomainErrorKind kind, string code, string title, string detail)
        : base(detail)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(detail);
        if (!ErrorCode.IsValid(code))
        {
            throw new ArgumentException($"Error code '{code}' must be kebab-case (a-z, 0-9, '-').", nameof(code));
        }

        Kind = kind;
        Code = code;
        Title = title;
    }

    /// <summary>The category, which decides the HTTP status code.</summary>
    public DomainErrorKind Kind { get; }

    /// <summary>Stable, kebab-case identifier of this error, e.g. <c>duplicate-title</c>.</summary>
    public string Code { get; }

    /// <summary>Short, human-readable summary that is the same for every occurrence of this error.</summary>
    public string Title { get; }
}
