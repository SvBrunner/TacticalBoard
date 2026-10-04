using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TacticalBoard.Api.ErrorHandling;

namespace TacticalBoard.UnitTests.Api;

public class ProblemDetailsEnricherTests
{
    private static ProblemDetailsContext CreateContext(ProblemDetails problem, int responseStatus = 200, string path = "/api/things")
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Path = path;
        httpContext.Response.StatusCode = responseStatus;
        return new ProblemDetailsContext { HttpContext = httpContext, ProblemDetails = problem };
    }

    [Fact]
    public void Replaces_the_framework_default_type_with_the_apps_type_for_the_status()
    {
        var context = CreateContext(new ProblemDetails { Status = 404, Type = "https://tools.ietf.org/html/rfc9110#section-15.5.5" });

        ProblemDetailsEnricher.Enrich(context);

        Assert.Equal("https://tacticalboard/errors/not-found", context.ProblemDetails.Type);
    }

    [Fact]
    public void Sets_a_type_when_there_is_none()
    {
        var context = CreateContext(new ProblemDetails { Status = 500 });

        ProblemDetailsEnricher.Enrich(context);

        Assert.Equal("https://tacticalboard/errors/internal-error", context.ProblemDetails.Type);
    }

    [Fact]
    public void Keeps_an_own_type()
    {
        var context = CreateContext(new ProblemDetails { Status = 409, Type = "https://tacticalboard/errors/duplicate-title" });

        ProblemDetailsEnricher.Enrich(context);

        Assert.Equal("https://tacticalboard/errors/duplicate-title", context.ProblemDetails.Type);
    }

    [Fact]
    public void Gives_validation_problems_the_validation_type()
    {
        var problem = new HttpValidationProblemDetails(new Dictionary<string, string[]> { ["title"] = ["Required."] }) { Status = 400 };
        var context = CreateContext(problem);

        ProblemDetailsEnricher.Enrich(context);

        Assert.Equal("https://tacticalboard/errors/validation-failed", context.ProblemDetails.Type);
    }

    [Fact]
    public void Takes_the_status_from_the_response_when_missing()
    {
        var context = CreateContext(new ProblemDetails(), responseStatus: 403);

        ProblemDetailsEnricher.Enrich(context);

        Assert.Equal(403, context.ProblemDetails.Status);
        Assert.Equal("https://tacticalboard/errors/forbidden", context.ProblemDetails.Type);
    }

    [Fact]
    public void Sets_the_instance_to_the_request_path()
    {
        var context = CreateContext(new ProblemDetails { Status = 404 }, path: "/api/missing");

        ProblemDetailsEnricher.Enrich(context);

        Assert.Equal("/api/missing", context.ProblemDetails.Instance);
    }

    [Fact]
    public void Keeps_an_explicit_instance()
    {
        var context = CreateContext(new ProblemDetails { Status = 404, Instance = "/api/situations/42" });

        ProblemDetailsEnricher.Enrich(context);

        Assert.Equal("/api/situations/42", context.ProblemDetails.Instance);
    }

    [Fact]
    public void Rejects_a_missing_context() =>
        Assert.Throws<ArgumentNullException>(() => ProblemDetailsEnricher.Enrich(null!));
}
