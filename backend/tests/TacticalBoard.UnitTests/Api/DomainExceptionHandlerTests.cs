using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Api.ErrorHandling;
using TacticalBoard.SharedKernel.Errors;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Api;

public class DomainExceptionHandlerTests
{
    private sealed class DuplicateTitleException()
        : DomainException(DomainErrorKind.Conflict, "duplicate-title", "Duplicate title", "A situation 'Powerplay' already exists.");

    private static DomainExceptionHandler CreateHandler(HttpContext context) =>
        new(context.RequestServices.GetRequiredService<IProblemDetailsService>());

    [Fact]
    public async Task Writes_a_domain_exception_as_problem_details()
    {
        var context = ProblemDetailsHttpContext.Create("/api/situations");

        var handled = await CreateHandler(context).TryHandleAsync(context, new DuplicateTitleException(), TestContext.Current.CancellationToken);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        Assert.StartsWith("application/problem+json", context.Response.ContentType, StringComparison.Ordinal);
        var body = ProblemDetailsHttpContext.ReadBody(context);
        Assert.Equal("https://tacticalboard/errors/duplicate-title", body.GetProperty("type").GetString());
        Assert.Equal("Duplicate title", body.GetProperty("title").GetString());
        Assert.Equal(409, body.GetProperty("status").GetInt32());
        Assert.Equal("A situation 'Powerplay' already exists.", body.GetProperty("detail").GetString());
        Assert.Equal("/api/situations", body.GetProperty("instance").GetString());
    }

    private sealed class ConflictWithDetailsException()
        : DomainException(DomainErrorKind.PreconditionFailed, "save-conflict", "Save conflict", "Someone else saved.")
    {
        public override IReadOnlyDictionary<string, object?> Details { get; } = new Dictionary<string, object?> { ["currentRevision"] = 8 };
    }

    [Fact]
    public async Task Adds_the_details_of_a_domain_exception_as_extension_members()
    {
        var context = ProblemDetailsHttpContext.Create("/api/situations/1");

        await CreateHandler(context).TryHandleAsync(context, new ConflictWithDetailsException(), TestContext.Current.CancellationToken);

        Assert.Equal(StatusCodes.Status412PreconditionFailed, context.Response.StatusCode);
        var body = ProblemDetailsHttpContext.ReadBody(context);
        Assert.Equal("https://tacticalboard/errors/save-conflict", body.GetProperty("type").GetString());
        Assert.Equal(8, body.GetProperty("currentRevision").GetInt32());
    }

    [Fact]
    public async Task Leaves_other_exceptions_to_the_default_handler()
    {
        var context = ProblemDetailsHttpContext.Create();

        var handled = await CreateHandler(context).TryHandleAsync(context, new InvalidOperationException("internal"), TestContext.Current.CancellationToken);

        Assert.False(handled);
        Assert.Equal(0, context.Response.Body.Length);
    }

    [Fact]
    public async Task Rejects_a_missing_context()
    {
        var context = ProblemDetailsHttpContext.Create();

        await Assert.ThrowsAsync<ArgumentNullException>(
            () => CreateHandler(context).TryHandleAsync(null!, new DuplicateTitleException(), TestContext.Current.CancellationToken).AsTask());
    }
}
