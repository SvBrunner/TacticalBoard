using Microsoft.AspNetCore.Antiforgery;

namespace TacticalBoard.Api.Authentication;

/// <summary>
/// <c>GET /api/antiforgery</c>: a request token for state-changing requests (arc42 ch. 8.13). The
/// response also sets the HttpOnly antiforgery cookie the token is checked against. The token is
/// bound to the session: fetch a new one after login or logout.
/// </summary>
public static class AntiforgeryEndpoint
{
    /// <summary>The path below the API prefix.</summary>
    public const string Path = "/antiforgery";

    /// <summary>The header the frontend sends the token in.</summary>
    public const string HeaderName = "X-CSRF-TOKEN";

    /// <summary>The form field name for plain HTML form posts (the logout form).</summary>
    public const string FormFieldName = "__RequestVerificationToken";

    /// <summary>Maps the endpoint.</summary>
    public static void MapAntiforgeryEndpoint(this IEndpointRouteBuilder api) => api.MapGet(Path, GetToken);

    /// <summary>Issues a token.</summary>
    public static IResult GetToken(HttpContext httpContext, IAntiforgery antiforgery)
    {
        ArgumentNullException.ThrowIfNull(antiforgery);
        var tokens = antiforgery.GetAndStoreTokens(httpContext);
        return TypedResults.Ok(new AntiforgeryTokenResponse(tokens.RequestToken!, HeaderName, FormFieldName));
    }
}

/// <summary>The body of <c>GET /api/antiforgery</c>.</summary>
/// <param name="Token">The request token.</param>
/// <param name="HeaderName">The header to send it in (fetch requests).</param>
/// <param name="FormFieldName">The form field to send it in (HTML form posts).</param>
public sealed record AntiforgeryTokenResponse(string Token, string HeaderName, string FormFieldName);
