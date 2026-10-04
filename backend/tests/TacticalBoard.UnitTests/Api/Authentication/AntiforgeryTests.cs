using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Api.Authentication;
using TacticalBoard.Api.ErrorHandling;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Api.Authentication;

public class AntiforgeryTests
{
    private static async Task<(DefaultHttpContext Context, bool NextCalled)> InvokeAsync(string method, string? token)
    {
        var context = ProblemDetailsHttpContext.Create("/api/me/display-name");
        context.Request.Method = method;
        if (token is not null)
        {
            context.Request.Headers[AntiforgeryEndpoint.HeaderName] = token;
        }

        var nextCalled = false;
        var middleware = new AntiforgeryValidationMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });
        await middleware.InvokeAsync(context, new FakeAntiforgery(), context.RequestServices.GetRequiredService<IProblemDetailsService>());
        return (context, nextCalled);
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("HEAD")]
    [InlineData("OPTIONS")]
    [InlineData("TRACE")]
    public async Task Lets_safe_requests_through_without_a_token(string method)
    {
        var (_, nextCalled) = await InvokeAsync(method, token: null);

        Assert.True(nextCalled);
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    [InlineData("DELETE")]
    public async Task Lets_state_changing_requests_through_with_a_valid_token(string method)
    {
        var (_, nextCalled) = await InvokeAsync(method, FakeAntiforgery.ValidToken);

        Assert.True(nextCalled);
    }

    [Theory]
    [InlineData("POST", null)]
    [InlineData("PUT", "forged")]
    [InlineData("PATCH", null)]
    [InlineData("DELETE", "forged")]
    public async Task Rejects_state_changing_requests_without_a_valid_token(string method, string? token)
    {
        var (context, nextCalled) = await InvokeAsync(method, token);

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        var problem = ProblemDetailsHttpContext.ReadBody(context);
        Assert.Equal(ProblemTypes.BaseUri + "invalid-antiforgery-token", problem.GetProperty("type").GetString());
        Assert.Equal(400, problem.GetProperty("status").GetInt32());
        Assert.Equal("/api/me/display-name", problem.GetProperty("instance").GetString());
    }

    [Theory]
    [InlineData("GET", false)]
    [InlineData("get", false)]
    [InlineData("POST", true)]
    [InlineData("PROPFIND", true)]
    public void Treats_every_non_safe_method_as_state_changing(string method, bool expected) =>
        Assert.Equal(expected, AntiforgeryValidationMiddleware.IsStateChanging(method));

    [Fact]
    public void The_endpoint_issues_a_request_token_with_where_to_send_it()
    {
        var result = AntiforgeryEndpoint.GetToken(new DefaultHttpContext(), new FakeAntiforgery());

        var ok = Assert.IsType<Ok<AntiforgeryTokenResponse>>(result);
        Assert.Equal(new AntiforgeryTokenResponse(FakeAntiforgery.ValidToken, "X-CSRF-TOKEN", "__RequestVerificationToken"), ok.Value);
        Assert.Equal("""{"token":"valid-token","headerName":"X-CSRF-TOKEN","formFieldName":"__RequestVerificationToken"}""", JsonSerializer.Serialize(ok.Value, JsonSerializerOptions.Web));
    }
}
