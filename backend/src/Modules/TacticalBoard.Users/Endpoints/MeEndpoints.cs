using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using TacticalBoard.Users.Application;
using TacticalBoard.SharedKernel.Validation;
using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Endpoints;

/// <summary>
/// The logged-in user's own account (arc42 ch. 8.13, 8.18): <c>GET /api/me</c>,
/// <c>PUT /api/me/display-name</c> and <c>PUT /api/me/language</c>. All need a session (otherwise <c>401</c>).
/// </summary>
internal static class MeEndpoints
{
    public const string Path = "/me";

    /// <summary>The name of the field in validation errors.</summary>
    public const string DisplayNameField = "displayName";

    /// <summary>The name of the language field in validation errors.</summary>
    public const string LanguageField = "language";

    public static void Map(IEndpointRouteBuilder api)
    {
        var me = api.MapGroup(Path).RequireAuthorization();
        me.MapGet(string.Empty, GetMe);
        me.MapPut("/display-name", ChangeDisplayNameAsync);
        me.MapPut("/language", ChangeLanguageAsync);
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
            var errors = new FieldErrors().Add(DisplayNameField, error);
            return TypedResults.ValidationProblem(errors.Messages(), extensions: errors.Extensions());
        }

        var updated = await profile.ChangeDisplayNameAsync(displayName, cancellationToken);
        return TypedResults.Ok(MeResponse.From(updated));
    }

    public static async Task<Results<Ok<MeResponse>, ValidationProblem>> ChangeLanguageAsync(
        [FromBody] ChangeLanguageRequest request,
        [FromServices] UserProfileService profile,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(profile);
        if (!LanguageTag.TryCreate(request.Language, out var language, out var error))
        {
            var errors = new FieldErrors().Add(LanguageField, error);
            return TypedResults.ValidationProblem(errors.Messages(), extensions: errors.Extensions());
        }

        var updated = await profile.ChangePreferredLanguageAsync(language, cancellationToken);
        return TypedResults.Ok(MeResponse.From(updated));
    }
}
