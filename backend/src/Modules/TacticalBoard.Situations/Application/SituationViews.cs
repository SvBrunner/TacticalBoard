namespace TacticalBoard.Situations.Application;

/// <summary>Who created or changed something: the user's id and display name, <c>null</c> for a deleted user.</summary>
internal sealed record UserReferenceView(Guid Id, string? DisplayName);

/// <summary>The metadata of a saved situation, as listed.</summary>
internal sealed record SituationSummaryView(
    Guid Id,
    string Title,
    string Sport,
    string FieldType,
    Guid? FolderId,
    int Revision,
    DateTimeOffset CreatedAt,
    UserReferenceView CreatedBy,
    DateTimeOffset UpdatedAt,
    UserReferenceView UpdatedBy);

/// <summary>A saved situation: its metadata and the current revision's document (JSON).</summary>
internal sealed record SituationView(SituationSummaryView Summary, string Document);
