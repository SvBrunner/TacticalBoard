using System.Text.Json;

namespace TacticalBoard.Situations.Endpoints;

/// <summary>The body of <c>POST /api/personal-area/situations</c>: the first save of a situation.</summary>
/// <param name="Document">The situation in the current file format (arc42 ch. 8.3).</param>
/// <param name="Origin"><c>new</c> (default), <c>imported</c> or <c>copy</c>; decides what happens with a taken title (ch. 8.15).</param>
internal sealed record CreateSituationRequest(JsonElement? Document, string? Origin);

/// <summary>The body of <c>PUT /api/situations/{id}</c> (with <c>If-Match</c>): a later save.</summary>
/// <param name="Document">The situation in the current file format.</param>
internal sealed record UpdateSituationRequest(JsonElement? Document);
