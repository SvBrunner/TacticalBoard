using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using TacticalBoard.Api.Health;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Api;

public class HealthTests
{
    private static HealthReport Report(HealthStatus database) =>
        new(
            new Dictionary<string, HealthReportEntry>
            {
                ["database"] = new(database, "The database cannot be reached.", TimeSpan.FromMilliseconds(3), new InvalidOperationException("secret"), null),
            },
            TimeSpan.FromMilliseconds(5));

    [Fact]
    public void Response_lists_the_overall_and_each_checks_status()
    {
        var response = HealthResponse.From(Report(HealthStatus.Unhealthy));

        Assert.Equal("Unhealthy", response.Status);
        Assert.Equal("Unhealthy", response.Checks["database"]);
    }

    [Fact]
    public void Response_rejects_a_missing_report() => Assert.Throws<ArgumentNullException>(() => HealthResponse.From(null!));

    [Fact]
    public async Task Writes_camel_case_json_without_error_details()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await HealthEndpoint.WriteResponseAsync(context, Report(HealthStatus.Healthy));

        Assert.Equal("application/json; charset=utf-8", context.Response.ContentType);
        context.Response.Body.Position = 0;
        var text = await new StreamReader(context.Response.Body).ReadToEndAsync(TestContext.Current.CancellationToken);
        var body = JsonDocument.Parse(text).RootElement;
        Assert.Equal("Healthy", body.GetProperty("status").GetString());
        Assert.Equal("Healthy", body.GetProperty("checks").GetProperty("database").GetString());
        Assert.DoesNotContain("secret", text, StringComparison.Ordinal);
        Assert.DoesNotContain("cannot be reached", text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Writing_rejects_a_missing_context() =>
        await Assert.ThrowsAsync<ArgumentNullException>(() => HealthEndpoint.WriteResponseAsync(null!, Report(HealthStatus.Healthy)));

    [Fact]
    public void Registers_the_database_check_with_a_timeout()
    {
        using var services = new ServiceCollection().AddApiHealthChecks().BuildServiceProvider();

        var registration = Assert.Single(services.GetRequiredService<IOptions<HealthCheckServiceOptions>>().Value.Registrations);

        Assert.Equal(HealthEndpoint.DatabaseCheckName, registration.Name);
        Assert.Equal(HealthStatus.Unhealthy, registration.FailureStatus);
        Assert.Equal(TimeSpan.FromSeconds(5), registration.Timeout);
    }

    [Fact]
    public async Task Database_check_is_healthy_when_the_database_can_be_reached()
    {
        using var context = TestDbContext.Create();

        var result = await new DatabaseHealthCheck(context).CheckHealthAsync(new HealthCheckContext(), TestContext.Current.CancellationToken);

        Assert.Equal(HealthStatus.Healthy, result.Status);
    }

    [Fact]
    public async Task Database_check_is_unhealthy_when_connecting_fails()
    {
        var context = TestDbContext.Create();
        await context.DisposeAsync();

        var result = await new DatabaseHealthCheck(context).CheckHealthAsync(new HealthCheckContext(), TestContext.Current.CancellationToken);

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.NotNull(result.Exception);
    }
}
