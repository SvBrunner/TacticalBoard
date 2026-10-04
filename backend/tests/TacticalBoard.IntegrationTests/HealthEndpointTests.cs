using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TacticalBoard.IntegrationTests.TestSupport;

namespace TacticalBoard.IntegrationTests;

public class HealthEndpointTests(PostgresFixture postgres)
{
    [Fact]
    public async Task Is_healthy_with_a_reachable_database()
    {
        await using var factory = ApiFactory.WithDatabase(postgres.NewDatabaseConnectionString());
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/api/health", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        Assert.Equal("Healthy", body.GetProperty("status").GetString());
        Assert.Equal("Healthy", body.GetProperty("checks").GetProperty("database").GetString());
        Assert.Contains("no-cache", response.Headers.CacheControl?.ToString() ?? string.Empty, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Is_unhealthy_without_a_database()
    {
        // Nothing listens on port 1; the app starts anyway because it does not migrate.
        await using var factory = ApiFactory.WithDatabase("Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none;Timeout=2", migrateOnStartup: false);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/api/health", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var body = JsonDocument.Parse(text).RootElement;
        Assert.Equal("Unhealthy", body.GetProperty("status").GetString());
        Assert.Equal("Unhealthy", body.GetProperty("checks").GetProperty("database").GetString());
        Assert.DoesNotContain("exception", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Answers_head_requests()
    {
        await using var factory = ApiFactory.WithDatabase(postgres.NewDatabaseConnectionString());
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Head, new Uri("/api/health", UriKind.Relative));
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
