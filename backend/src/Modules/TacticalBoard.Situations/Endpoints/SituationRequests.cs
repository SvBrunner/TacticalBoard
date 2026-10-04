using System.Text.Json;

namespace TacticalBoard.Situations.Endpoints;

/// <summary>The body of <c>POST /api/personal-area/situations</c> and <c>POST /api/folders/{folderId}/situations</c>: the first save of a situation.</summary>
/// <param name="Document">The situation in the current file format (arc42 ch. 8.3).</param>
/// <param name="Origin"><c>new</c> (default), <c>imported</c> or <c>copy</c>; decides what happens with a taken title (ch. 8.15).</param>
/// <param name="TitleIsDefault">
/// With <c>new</c>: the title is the default title of the client's UI language (ch. 8.18), so a taken
/// one gets the next free number like the server's own default title. Ignored for other origins.
/// </param>
internal sealed record CreateSituationRequest(JsonElement? Document, string? Origin, bool? TitleIsDefault = null);

/// <summary>The body of <c>PUT /api/situations/{id}</c> (with <c>If-Match</c>): a later save.</summary>
/// <param name="Document">The situation in the current file format.</param>
internal sealed record UpdateSituationRequest(JsonElement? Document);

/// <summary>The body of <c>PUT /api/situations/{id}/folder</c>: where the situation goes in its area.</summary>
/// <param name="FolderId">A folder of the situation's area, or <c>null</c> for the top level.</param>
internal sealed record MoveSituationRequest(Guid? FolderId);
