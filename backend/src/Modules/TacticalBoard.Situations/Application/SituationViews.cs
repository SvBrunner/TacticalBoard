using TacticalBoard.Areas.Contracts;

namespace TacticalBoard.Situations.Application;

/// <summary>Who created or changed something: the user's id and display name, <c>null</c> for a deleted user.</summary>
internal sealed record UserReferenceView(Guid Id, string? DisplayName);

/// <summary>
/// The metadata of a saved situation, as listed: with its area and whether the current user may
/// change it (<c>CanWrite</c>: save, move, delete — false for a team Reader, arc42 ch. 8.1).
/// </summary>
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
    UserReferenceView UpdatedBy,
    AreaReference Area,
    bool CanWrite);

/// <summary>A saved situation: its metadata and the current revision's document (JSON).</summary>
internal sealed record SituationView(SituationSummaryView Summary, string Document);
