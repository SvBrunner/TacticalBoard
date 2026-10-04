using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Situations.Application;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.Situations.Endpoints;

/// <summary>
/// Saved situations over REST (arc42 ch. 8.15). All need a session (otherwise <c>401</c>); the
/// state-changing ones also the antiforgery header (ch. 8.13).
/// <list type="bullet">
/// <item><c>GET /api/personal-area/situations</c>: the current user's situations (metadata only).</item>
/// <item><c>POST /api/personal-area/situations</c>: first save → <c>201</c>, <c>Location</c>, <c>ETag</c>.</item>
/// <item><c>GET /api/situations/{id}</c>: metadata + document, <c>ETag</c>.</item>
/// <item><c>PUT /api/situations/{id}</c> with <c>If-Match</c>: later save → <c>200</c> + <c>ETag</c>, or <c>412</c> on a conflict, <c>428</c> without <c>If-Match</c>.</item>
/// <item><c>DELETE /api/situations/{id}</c>: soft delete → <c>204</c>.</item>
/// </list>
/// </summary>
internal static class SituationEndpoints
{
    public const string PersonalAreaPath = "/personal-area/situations";
    public const string SituationsPath = "/situations";
    public const string GetSituationRoute = "GetSituation";

    /// <summary>The validation error key of the request's document.</summary>
    public const string DocumentField = "document";

    /// <summary>The validation error key of the request's origin.</summary>
    public const string OriginField = "origin";

    public static void Map(IEndpointRouteBuilder api)
    {
        var personal = api.MapGroup(PersonalAreaPath).RequireAuthorization();
        personal.MapGet(string.Empty, ListPersonalAsync);
        personal.MapPost(string.Empty, CreatePersonalAsync);

        var situations = api.MapGroup(SituationsPath).RequireAuthorization();
        situations.MapGet("/{id:guid}", GetAsync).WithName(GetSituationRoute);
        situations.MapPut("/{id:guid}", UpdateAsync);
        situations.MapDelete("/{id:guid}", DeleteAsync);
    }

    public static async Task<Ok<List<SituationSummaryResponse>>> ListPersonalAsync(
        [FromServices] SituationService service,
        [FromServices] IAreaAccess areas,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(areas);
        var list = await service.ListAsync(areas.CurrentUsersPersonalArea(), cancellationToken);
        return TypedResults.Ok(list.Select(SituationSummaryResponse.From).ToList());
    }

    public static async Task<Results<CreatedAtRoute<SituationResponse>, ValidationProblem>> CreatePersonalAsync(
        [FromBody] CreateSituationRequest request,
        [FromServices] SituationService service,
        [FromServices] IAreaAccess areas,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(areas);
        ArgumentNullException.ThrowIfNull(response);

        var errors = new Dictionary<string, string[]>();
        var origin = ParseOrigin(request.Origin, errors);
        var parsed = ParseDocument(request.Document, errors);
        if (errors.Count > 0 || parsed is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var view = await service.CreateAsync(areas.CurrentUsersPersonalArea(), parsed.Value.Title, parsed.Value.Document, origin, cancellationToken);
        response.Headers.ETag = RevisionTag.Format(view.Summary.Revision);
        return TypedResults.CreatedAtRoute(SituationResponse.From(view), GetSituationRoute, new { id = view.Summary.Id });
    }

    public static async Task<Ok<SituationResponse>> GetAsync(
        Guid id,
        [FromServices] SituationService service,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(response);
        var view = await service.GetAsync(id, cancellationToken);
        response.Headers.ETag = RevisionTag.Format(view.Summary.Revision);
        return TypedResults.Ok(SituationResponse.From(view));
    }

    public static async Task<Results<Ok<SituationResponse>, ValidationProblem, ProblemHttpResult>> UpdateAsync(
        Guid id,
        [FromBody] UpdateSituationRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        [FromServices] SituationService service,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(response);
        if (string.IsNullOrWhiteSpace(ifMatch))
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status428PreconditionRequired,
                detail: $"Saving needs the header {HeaderNames.IfMatch} with the revision (ETag) the change is based on.");
        }

        if (!RevisionTag.TryParse(ifMatch, out var expectedRevision))
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                detail: $"The header {HeaderNames.IfMatch} must be one revision tag, e.g. \"7\".");
        }

        var errors = new Dictionary<string, string[]>();
        var parsed = ParseDocument(request.Document, errors);
        if (parsed is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var view = await service.UpdateAsync(id, expectedRevision, parsed.Value.Title, parsed.Value.Document, cancellationToken);
        response.Headers.ETag = RevisionTag.Format(view.Summary.Revision);
        return TypedResults.Ok(SituationResponse.From(view));
    }

    public static async Task<NoContent> DeleteAsync(Guid id, [FromServices] SituationService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        await service.DeleteAsync(id, cancellationToken);
        return TypedResults.NoContent();
    }

    private static SituationOrigin ParseOrigin(string? origin, Dictionary<string, string[]> errors)
    {
        switch (origin)
        {
            case null or "new":
                return SituationOrigin.New;
            case "imported":
                return SituationOrigin.Imported;
            case "copy":
                return SituationOrigin.Copy;
            default:
                errors[OriginField] = ["expected \"new\", \"imported\" or \"copy\""];
                return SituationOrigin.New;
        }
    }

    /// <summary>The document and its title, or <c>null</c> with the problems added to <paramref name="errors"/> (keys <c>document.{path}</c>).</summary>
    private static (SituationDocument Document, SituationTitle Title)? ParseDocument(JsonElement? json, Dictionary<string, string[]> errors)
    {
        if (json is null || json.Value.ValueKind == JsonValueKind.Null)
        {
            errors[DocumentField] = ["The situation document is missing."];
            return null;
        }

        if (!SituationDocument.TryParse(json.Value, out var document, out var issues))
        {
            foreach (var group in issues.GroupBy(issue => FieldKey(issue.Path)))
            {
                errors[group.Key] = group.Select(issue => issue.Message).ToArray();
            }

            return null;
        }

        if (!SituationTitle.TryCreate(document.Title, out var title, out var error))
        {
            errors[FieldKey("situation.title")] = [error];
            return null;
        }

        return (document, title);
    }

    private static string FieldKey(string path) => path == "(root)" ? DocumentField : $"{DocumentField}.{path}";
}
