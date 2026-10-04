using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using TacticalBoard.Users.Application;
using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Endpoints;

/// <summary>
/// The logged-in user's own account (arc42 ch. 8.13): <c>GET /api/me</c> and
/// <c>PUT /api/me/display-name</c>. Both need a session (otherwise <c>401</c>).
/// </summary>
internal static class MeEndpoints
{
    public const string Path = "/me";

    /// <summary>The name of the field in validation errors.</summary>
    public const string DisplayNameField = "displayName";

    public static void Map(IEndpointRouteBuilder api)
    {
        var me = api.MapGroup(Path).RequireAuthorization();
        me.MapGet(string.Empty, GetMe);
        me.MapPut("/display-name", ChangeDisplayNameAsync);
    }

    public static Ok<MeResponse> GetMe([FromServices] CurrentUserState currentUser)
    {
        ArgumentNullException.ThrowIfNull(currentUser);
        return TypedResults.Ok(MeResponse.From(currentUser.User));
    }

    public static async Task<Results<Ok<MeResponse>, ValidationProblem>> ChangeDisplayNameAsync(
        [FromBody] ChangeDisplayNameRequest request,
        [FromServices] UserProfileService profile,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(profile);
        if (!DisplayName.TryCreate(request.DisplayName, out var displayName, out var error))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { [DisplayNameField] = [error] });
        }

        var updated = await profile.ChangeDisplayNameAsync(displayName, cancellationToken);
        return TypedResults.Ok(MeResponse.From(updated));
    }
}
