using TacticalBoard.Areas.Contracts;
using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.Situations.Domain;

/// <summary>
/// A saved situation (ADR-009): the metadata as columns, the content in its revisions
/// (<see cref="SituationRevision"/>). Every save adds a revision and makes it the current one;
/// <see cref="CurrentRevision"/> is the concurrency token (ETag). Sport and field type are fixed
/// when the situation is created. Soft-deleted (ch. 8.16).
/// </summary>
internal sealed class Situation : SoftDeletableEntity
{
    // For EF Core.
    private Situation()
    {
        Title = string.Empty;
        NormalizedTitle = string.Empty;
        Sport = string.Empty;
        FieldType = string.Empty;
    }

    public Guid Id { get; private set; }

    public AreaKind AreaKind { get; private set; }

    /// <summary>The owner of the area (the user of a personal area, the team of a team area).</summary>
    public Guid AreaOwnerId { get; private set; }

    /// <summary>The area the situation lives in; it never changes (no moving between areas, ch. 1).</summary>
    public AreaReference Area => new(AreaKind, AreaOwnerId);

    /// <summary>The folder within the area, or <c>null</c> for the top level. Reserved for folders (roadmap Phase 2 step 4); always <c>null</c> for now.</summary>
    public Guid? FolderId { get; private set; }

    public string Title { get; private set; }

    /// <summary><see cref="SituationTitle.Normalized"/> of <see cref="Title"/>; unique per area among non-deleted situations.</summary>
    public string NormalizedTitle { get; private set; }

    public string Sport { get; private set; }

    public string FieldType { get; private set; }

    /// <summary>The file format version of the current revision's document.</summary>
    public int FormatVersion { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public Guid UpdatedBy { get; private set; }

    /// <summary>The number of the newest revision (1 for a new situation).</summary>
    public int CurrentRevision { get; private set; }

    /// <summary>Creates a situation from its first save, with revision 1.</summary>
    public static (Situation Situation, SituationRevision Revision) Create(
        Guid id,
        AreaReference area,
        SituationTitle title,
        SituationDocument document,
        DateTimeOffset at,
        Guid by)
    {
        ArgumentNullException.ThrowIfNull(area);
        ArgumentNullException.ThrowIfNull(title);
        ArgumentNullException.ThrowIfNull(document);
        if (id == Guid.Empty)
        {
            throw new ArgumentException("The id must not be empty.", nameof(id));
        }

        var situation = new Situation
        {
            Id = id,
            AreaKind = area.Kind,
            AreaOwnerId = area.OwnerId,
            Sport = document.Sport,
            FieldType = document.FieldType,
            CreatedAt = at,
            CreatedBy = by,
        };
        var revision = situation.Apply(title, document, at, by, revisionNumber: 1);
        return (situation, revision);
    }

    /// <summary>A later save: the next revision with this document and title.</summary>
    /// <exception cref="SituationPropertyChangedException">The document changes the sport or the field type.</exception>
    public SituationRevision Revise(SituationTitle title, SituationDocument document, DateTimeOffset at, Guid by)
    {
        ArgumentNullException.ThrowIfNull(title);
        ArgumentNullException.ThrowIfNull(document);
        if (document.Sport != Sport)
        {
            throw SituationPropertyChangedException.Sport();
        }

        if (document.FieldType != FieldType)
        {
            throw SituationPropertyChangedException.FieldType();
        }

        return Apply(title, document, at, by, CurrentRevision + 1);
    }

    private SituationRevision Apply(SituationTitle title, SituationDocument document, DateTimeOffset at, Guid by, int revisionNumber)
    {
        Title = title.Value;
        NormalizedTitle = title.Normalized;
        FormatVersion = SituationDocument.FormatVersion;
        UpdatedAt = at;
        UpdatedBy = by;
        CurrentRevision = revisionNumber;
        return new SituationRevision(Id, revisionNumber, document.Stamp(Id, title, CreatedAt, at), at, by);
    }
}
