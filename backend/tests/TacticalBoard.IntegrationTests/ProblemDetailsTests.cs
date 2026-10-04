using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TacticalBoard.IntegrationTests.TestSupport;

namespace TacticalBoard.IntegrationTests;

/// <summary>Problem Details for errors produced by the framework itself, through the real Program.</summary>
public class ProblemDetailsTests(PostgresFixture postgres)
{
    private static async Task<JsonElement> ProblemAsync(HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        return await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task An_unknown_api_path_is_a_not_found_problem()
    {
        await using var factory = ApiFactory.WithDatabase(postgres.NewDatabaseConnectionString());
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/api/does-not-exist", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var problem = await ProblemAsync(response);
        Assert.Equal("https://tacticalboard/errors/not-found", problem.GetProperty("type").GetString());
        Assert.Equal(404, problem.GetProperty("status").GetInt32());
        Assert.Equal("/api/does-not-exist", problem.GetProperty("instance").GetString());
        Assert.False(string.IsNullOrEmpty(problem.GetProperty("traceId").GetString()));
    }

    [Fact]
    public async Task A_wrong_method_is_a_method_not_allowed_problem()
    {
        await using var factory = ApiFactory.WithDatabase(postgres.NewDatabaseConnectionString());
        using var client = factory.CreateClient();

        using var response = await client.PostAsync(new Uri("/api/health", UriKind.Relative), null, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        var problem = await ProblemAsync(response);
        Assert.Equal("https://tacticalboard/errors/method-not-allowed", problem.GetProperty("type").GetString());
    }
}
