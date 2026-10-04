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
/// <item><c>GET /api/personal-area/folders</c>: the current user's folders, by name.</item>
/// <item><c>POST /api/personal-area/folders</c> with <c>{ name }</c>: create → <c>201</c>, <c>Location</c>.</item>
/// <item><c>GET /api/folders/{id}</c>: one folder.</item>
/// <item><c>PUT /api/folders/{id}</c> with <c>{ name }</c>: rename.</item>
/// <item><c>DELETE /api/folders/{id}</c>: soft delete of an empty folder → <c>204</c>, otherwise <c>409 folder-not-empty</c>.</item>
/// </list>
/// The situations of a folder are listed and created by the Situations module (<c>/api/folders/{id}/situations</c>).
/// </summary>
internal static class FolderEndpoints
{
    public const string PersonalAreaPath = "/personal-area/folders";
    public const string FoldersPath = "/folders";
    public const string GetFolderRoute = "GetFolder";

    /// <summary>The validation error key of the request's name.</summary>
    public const string NameField = "name";

    public static void Map(IEndpointRouteBuilder api)
    {
        var personal = api.MapGroup(PersonalAreaPath).RequireAuthorization();
        personal.MapGet(string.Empty, ListPersonalAsync);
        personal.MapPost(string.Empty, CreatePersonalAsync);

        var folders = api.MapGroup(FoldersPath).RequireAuthorization();
        folders.MapGet("/{id:guid}", GetAsync).WithName(GetFolderRoute);
        folders.MapPut("/{id:guid}", RenameAsync);
        folders.MapDelete("/{id:guid}", DeleteAsync);
    }

    public static async Task<Ok<List<FolderResponse>>> ListPersonalAsync(
        [FromServices] FolderService service,
        [FromServices] IAreaAccess areas,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(areas);
        var list = await service.ListAsync(areas.CurrentUsersPersonalArea(), cancellationToken);
        return TypedResults.Ok(list.Select(FolderResponse.From).ToList());
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

        var view = await service.CreateAsync(areas.CurrentUsersPersonalArea(), name, cancellationToken);
        return TypedResults.CreatedAtRoute(FolderResponse.From(view), GetFolderRoute, new { id = view.Id });
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

    private static ValidationProblem NameProblem(FieldError error)
    {
        var errors = new FieldErrors().Add(NameField, error);
        return TypedResults.ValidationProblem(errors.Messages(), extensions: errors.Extensions());
    }
}
