using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.Situations.Domain;

/// <summary>The situation does not exist, is deleted, or lies in an area the current user can't read (no hint which).</summary>
internal sealed class SituationNotFoundException(Guid id)
    : DomainException(DomainErrorKind.NotFound, "situation-not-found", "Situation not found", $"There is no situation {id}.");

/// <summary>The current user may read but not change content of the area (e.g. a team Reader, later).</summary>
internal sealed class SituationAccessDeniedException()
    : DomainException(DomainErrorKind.Forbidden, "forbidden", "Forbidden", "You may not change situations in this area.");

/// <summary>Another non-deleted situation of the area has this title (ignoring case and surrounding whitespace).</summary>
internal sealed class DuplicateSituationTitleException(string title)
    : DomainException(DomainErrorKind.Conflict, "duplicate-title", "Duplicate title", $"A situation titled \"{title}\" already exists here.")
{
    /// <inheritdoc />
    public override IReadOnlyDictionary<string, object?> Details { get; } = new Dictionary<string, object?> { ["existingTitle"] = title };
}

/// <summary>
/// The situation was saved by someone else since the client read it (optimistic concurrency,
/// ch. 8.15). <see cref="CurrentRevision"/> lets the client overwrite on purpose.
/// </summary>
internal sealed class SituationSaveConflictException(int currentRevision)
    : DomainException(
        DomainErrorKind.PreconditionFailed,
        "save-conflict",
        "Save conflict",
        $"The situation was saved by someone else in the meantime (now revision {currentRevision}).")
{
    public int CurrentRevision { get; } = currentRevision;

    /// <inheritdoc />
    public override IReadOnlyDictionary<string, object?> Details { get; } = new Dictionary<string, object?> { ["currentRevision"] = currentRevision };
}

/// <summary>A save tried to change what is fixed when a situation is created (sport, field type).</summary>
internal sealed class SituationPropertyChangedException : DomainException
{
    private SituationPropertyChangedException(string code, string title, string detail)
        : base(DomainErrorKind.Validation, code, title, detail)
    {
    }

    public static SituationPropertyChangedException FieldType() =>
        new("field-type-changed", "Field type changed", "The field type of a situation can't be changed.");

    public static SituationPropertyChangedException Sport() =>
        new("sport-changed", "Sport changed", "The sport of a situation can't be changed.");
}
