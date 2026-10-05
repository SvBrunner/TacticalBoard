using System.Text.Json;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Situations.Application;

namespace TacticalBoard.Situations.Endpoints;

/// <summary>A user who created or changed a situation; <c>displayName</c> is <c>null</c> for a deleted user.</summary>
internal sealed record UserReferenceResponse(Guid Id, string? DisplayName)
{
    public static UserReferenceResponse From(UserReferenceView user)
    {
        ArgumentNullException.ThrowIfNull(user);
        return new UserReferenceResponse(user.Id, user.DisplayName);
    }
}

/// <summary>A situation's metadata, as listed (arc42 ch. 8.15): with its area and whether the current user may change it (<c>canWrite</c>).</summary>
internal sealed record SituationSummaryResponse(
    Guid Id,
    string Title,
    string Sport,
    string FieldType,
    Guid? FolderId,
    int Revision,
    DateTimeOffset CreatedAt,
    UserReferenceResponse CreatedBy,
    DateTimeOffset UpdatedAt,
    UserReferenceResponse UpdatedBy,
    AreaResponse Area,
    bool CanWrite)
{
    public static SituationSummaryResponse From(SituationSummaryView summary)
    {
        ArgumentNullException.ThrowIfNull(summary);
        return new SituationSummaryResponse(
            summary.Id,
            summary.Title,
            summary.Sport,
            summary.FieldType,
            summary.FolderId,
            summary.Revision,
            summary.CreatedAt,
            UserReferenceResponse.From(summary.CreatedBy),
            summary.UpdatedAt,
            UserReferenceResponse.From(summary.UpdatedBy),
            AreaResponse.From(summary.Area),
            summary.CanWrite);
    }
}

/// <summary>A saved situation: its metadata and its current document (the ETag header carries the revision too).</summary>
internal sealed record SituationResponse(
    Guid Id,
    string Title,
    string Sport,
    string FieldType,
    Guid? FolderId,
    int Revision,
    DateTimeOffset CreatedAt,
    UserReferenceResponse CreatedBy,
    DateTimeOffset UpdatedAt,
    UserReferenceResponse UpdatedBy,
    AreaResponse Area,
    bool CanWrite,
    JsonElement Document)
{
    public static SituationResponse From(SituationView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        var summary = SituationSummaryResponse.From(view.Summary);
        using var document = JsonDocument.Parse(view.Document);
        return new SituationResponse(
            summary.Id,
            summary.Title,
            summary.Sport,
            summary.FieldType,
            summary.FolderId,
            summary.Revision,
            summary.CreatedAt,
            summary.CreatedBy,
            summary.UpdatedAt,
            summary.UpdatedBy,
            summary.Area,
            summary.CanWrite,
            document.RootElement.Clone());
    }
}
