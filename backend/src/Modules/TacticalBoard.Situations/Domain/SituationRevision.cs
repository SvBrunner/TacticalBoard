namespace TacticalBoard.Situations.Domain;

/// <summary>
/// One saved state of a situation (ADR-009): the complete document in the current file format,
/// with the server-owned values stamped in. Never changed after it was written.
/// </summary>
internal sealed class SituationRevision
{
    public SituationRevision(Guid situationId, int number, string document, DateTimeOffset createdAt, Guid createdBy)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(number, 1);
        ArgumentException.ThrowIfNullOrWhiteSpace(document);
        SituationId = situationId;
        Number = number;
        Document = document;
        CreatedAt = createdAt;
        CreatedBy = createdBy;
    }

    public Guid SituationId { get; private set; }

    /// <summary>1, 2, 3, … per situation.</summary>
    public int Number { get; private set; }

    /// <summary>The situation document as JSON.</summary>
    public string Document { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public Guid CreatedBy { get; private set; }
}
