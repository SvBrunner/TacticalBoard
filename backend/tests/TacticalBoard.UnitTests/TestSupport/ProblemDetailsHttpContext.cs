using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Api.ErrorHandling;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>An <see cref="HttpContext"/> with the API's error handling services and a readable response body.</summary>
internal static class ProblemDetailsHttpContext
{
    public static DefaultHttpContext Create(string path = "/api/things")
    {
        var services = new ServiceCollection().AddLogging().AddApiErrorHandling().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();
        return context;
    }

    public static JsonElement ReadBody(HttpContext context)
    {
        context.Response.Body.Position = 0;
        return JsonDocument.Parse(context.Response.Body).RootElement.Clone();
    }
}
