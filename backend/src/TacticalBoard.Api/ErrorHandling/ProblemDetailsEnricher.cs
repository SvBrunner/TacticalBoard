using Microsoft.AspNetCore.Http;

namespace TacticalBoard.Api.ErrorHandling;

/// <summary>
/// Makes every Problem Details response consistent (arc42 ch. 8.2): replaces the framework's
/// default <c>type</c> links with this app's type URIs and sets <c>instance</c> to the request path.
/// </summary>
public static class ProblemDetailsEnricher
{
    /// <summary>Applies the conventions to <paramref name="context"/>'s problem details.</summary>
    public static void Enrich(ProblemDetailsContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var problem = context.ProblemDetails;
        var status = problem.Status ?? context.HttpContext.Response.StatusCode;
        problem.Status = status;

        if (!ProblemTypes.IsOwn(problem.Type))
        {
            problem.Type = problem is HttpValidationProblemDetails
                ? ProblemTypes.ForCode(ProblemTypes.ValidationFailedCode)
                : ProblemTypes.ForStatusCode(status);
        }

        problem.Instance ??= context.HttpContext.Request.Path.Value;
    }
}
