using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Application;
using TacticalBoard.Folders.Domain;
using TacticalBoard.SharedKernel.Validation;

namespace TacticalBoard.Folders.Endpoints;

/// <summary>
/// Folders over REST (arc42 ch. 8.15). All need a session (otherwise <c>401</c>); the
/// state-changing ones also the antiforgery header (ch. 8.13).
/// <list type="bullet">
/// <item><c>GET /api/personal-area/folders</c>: the current user's folders, by name, each with its <c>situationCount</c>.</item>
/// <item><c>POST /api/personal-area/folders</c> with <c>{ name }</c>: create → <c>201</c>, <c>Location</c>.</item>
/// <item><c>GET /api/teams/{team}/folders</c>, <c>POST /api/teams/{team}/folders</c>: the same for a team's area (<c>{team}</c>: its code or id; <c>404 team-not-found</c>; members read, Admins and Editors create, otherwise <c>403</c>).</item>
/// <item><c>GET /api/folders/{id}</c>: one folder.</item>
/// <item><c>PUT /api/folders/{id}</c> with <c>{ name }</c>: rename.</item>
/// <item><c>DELETE /api/folders/{id}</c>: soft delete of an empty folder → <c>204</c>, otherwise <c>409 folder-not-empty</c>.</item>
/// </list>
/// The situations of a folder are listed and created by the Situations module (<c>/api/folders/{id}/situations</c>).
/// </summary>
internal static class FolderEndpoints
{
    public const string PersonalAreaPath = "/personal-area/folders";
    public const string TeamAreaPath = "/teams/{team}/folders";
    public const string FoldersPath = "/folders";
    public const string GetFolderRoute = "GetFolder";

    /// <summary>The validation error key of the request's name.</summary>
    public const string NameField = "name";

    public static void Map(IEndpointRouteBuilder api)
    {
        var personal = api.MapGroup(PersonalAreaPath).RequireAuthorization();
        personal.MapGet(string.Empty, ListPersonalAsync);
        personal.MapPost(string.Empty, CreatePersonalAsync);

        var team = api.MapGroup(TeamAreaPath).RequireAuthorization();
        team.MapGet(string.Empty, ListTeamAsync);
        team.MapPost(string.Empty, CreateTeamAsync);

        var folders = api.MapGroup(FoldersPath).RequireAuthorization();
        folders.MapGet("/{id:guid}", GetAsync).WithName(GetFolderRoute);
        folders.MapPut("/{id:guid}", RenameAsync);
        folders.MapDelete("/{id:guid}", DeleteAsync);
    }

    public static async Task<Ok<List<FolderSummaryResponse>>> ListPersonalAsync(
        [FromServices] FolderService service,
        [FromServices] IAreaAccess areas,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(areas);
        return await ListAsync(service, areas.CurrentUsersPersonalArea(), cancellationToken);
    }

    public static async Task<Ok<List<FolderSummaryResponse>>> ListTeamAsync(
        string team,
        [FromServices] FolderService service,
        [FromServices] IAreaDirectory areas,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(areas);
        return await ListAsync(service, await areas.TeamAreaAsync(team, cancellationToken), cancellationToken);
    }

    public static async Task<Results<CreatedAtRoute<FolderResponse>, ValidationProblem>> CreateTeamAsync(
        string team,
        [FromBody] FolderNameRequest request,
        [FromServices] FolderService service,
        [FromServices] IAreaDirectory areas,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(areas);
        if (!FolderName.TryCreate(request.Name, out var name, out var error))
        {
            return NameProblem(error);
        }

        return await CreateAsync(service, await areas.TeamAreaAsync(team, cancellationToken), name, cancellationToken);
    }

    public static async Task<Results<CreatedAtRoute<FolderResponse>, ValidationProblem>> CreatePersonalAsync(
        [FromBody] FolderNameRequest request,
        [FromServices] FolderService service,
        [FromServices] IAreaAccess areas,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(areas);
        if (!FolderName.TryCreate(request.Name, out var name, out var error))
        {
            return NameProblem(error);
        }

        return await CreateAsync(service, areas.CurrentUsersPersonalArea(), name, cancellationToken);
    }

    public static async Task<Ok<FolderResponse>> GetAsync(Guid id, [FromServices] FolderService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        return TypedResults.Ok(FolderResponse.From(await service.GetAsync(id, cancellationToken)));
    }

    public static async Task<Results<Ok<FolderResponse>, ValidationProblem>> RenameAsync(
        Guid id,
        [FromBody] FolderNameRequest request,
        [FromServices] FolderService service,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(service);
        if (!FolderName.TryCreate(request.Name, out var name, out var error))
        {
            return NameProblem(error);
        }

        return TypedResults.Ok(FolderResponse.From(await service.RenameAsync(id, name, cancellationToken)));
    }

    public static async Task<NoContent> DeleteAsync(Guid id, [FromServices] FolderService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        await service.DeleteAsync(id, cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<Ok<List<FolderSummaryResponse>>> ListAsync(FolderService service, AreaReference area, CancellationToken cancellationToken)
    {
        var list = await service.ListAsync(area, cancellationToken);
        return TypedResults.Ok(list.Select(FolderSummaryResponse.From).ToList());
    }

    private static async Task<Results<CreatedAtRoute<FolderResponse>, ValidationProblem>> CreateAsync(
        FolderService service,
        AreaReference area,
        FolderName name,
        CancellationToken cancellationToken)
    {
        var view = await service.CreateAsync(area, name, cancellationToken);
        return TypedResults.CreatedAtRoute(FolderResponse.From(view), GetFolderRoute, new { id = view.Id });
    }

    private static ValidationProblem NameProblem(FieldError error)
    {
        var errors = new FieldErrors().Add(NameField, error);
        return TypedResults.ValidationProblem(errors.Messages(), extensions: errors.Extensions());
    }
}
