using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.Api.ErrorHandling;

/// <summary>
/// Turns a <see cref="DomainException"/> thrown by any endpoint into a Problem Details response
/// with the error's own <c>type</c> URI, title and detail. Other exceptions are left to the
/// default handler (a generic 500 without internals).
/// </summary>
public sealed class DomainExceptionHandler(IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(httpContext);
        if (exception is not DomainException domainException)
        {
            return false;
        }

        var status = DomainErrorStatusCodes.For(domainException.Kind);
        httpContext.Response.StatusCode = status;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Type = ProblemTypes.ForCode(domainException.Code),
                Title = domainException.Title,
                Detail = domainException.Message,
            },
        });
    }
}
