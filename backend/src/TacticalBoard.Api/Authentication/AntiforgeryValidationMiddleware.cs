using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using TacticalBoard.Api.ErrorHandling;

namespace TacticalBoard.Api.Authentication;

/// <summary>
/// CSRF protection (ADR-006, arc42 ch. 8.13): every state-changing request (<c>POST</c>,
/// <c>PUT</c>, <c>PATCH</c>, <c>DELETE</c>) needs a valid antiforgery token, in the
/// <c>X-CSRF-TOKEN</c> header or (HTML forms) the form field; otherwise it gets <c>400</c>
/// with the problem type <c>invalid-antiforgery-token</c>. Runs after authentication and
/// authorization, so a request without a session still gets <c>401</c> first.
/// </summary>
public sealed class AntiforgeryValidationMiddleware(RequestDelegate next)
{
    /// <summary>The problem code of a missing or invalid token.</summary>
    public const string ErrorCode = "invalid-antiforgery-token";

    /// <summary>Validates and continues, or answers <c>400</c>.</summary>
    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery, IProblemDetailsService problemDetails)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(antiforgery);
        ArgumentNullException.ThrowIfNull(problemDetails);
        if (!IsStateChanging(context.Request.Method) || await antiforgery.IsRequestValidAsync(context))
        {
            await next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await problemDetails.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Type = ProblemTypes.ForCode(ErrorCode),
                Title = "Invalid antiforgery token",
                Detail = $"State-changing requests need a valid antiforgery token (header {AntiforgeryEndpoint.HeaderName}, see GET /api/antiforgery).",
            },
        });
    }

    /// <summary>Whether <paramref name="method"/> changes state (everything but GET, HEAD, OPTIONS, TRACE).</summary>
    public static bool IsStateChanging(string method) =>
        !(HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method) || HttpMethods.IsTrace(method));
}
