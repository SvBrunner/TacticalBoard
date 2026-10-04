using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TacticalBoard.Api.Hosting;
using TacticalBoard.Infrastructure.Modularity;
using TacticalBoard.IntegrationTests.TestSupport;
using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.IntegrationTests;

/// <summary>
/// Exceptions thrown by module endpoints, through the real pipeline of <see cref="ApiHost"/>
/// with an extra test module that throws.
/// </summary>
public sealed class ExceptionHandlingTests(PostgresFixture postgres) : IAsyncLifetime
{
    private sealed class LastAdminException()
        : DomainException(DomainErrorKind.Conflict, "last-admin", "Last Admin", "The team needs at least one Admin.");

    private sealed class ThrowingModule : IModule
    {
        public string Name => "Throwing";

        public void RegisterServices(IServiceCollection services, IConfiguration configuration)
        {
        }

        public void MapEndpoints(IEndpointRouteBuilder api)
        {
            api.MapGet("/test/domain-error", () => { throw new LastAdminException(); });
            api.MapGet("/test/crash", () => { throw new InvalidOperationException("secret internal detail"); });
        }
    }

    private WebApplication? _app;
    private HttpClient? _client;

    public async ValueTask InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = Environments.Production });
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:TacticalBoard"] = postgres.NewDatabaseConnectionString(),
            ["Database:MigrateOnStartup"] = "false",
        });
        var host = new ApiHost([.. ModuleCatalog.All, new ThrowingModule()]);
        host.ConfigureServices(builder.Services, builder.Configuration);
        _app = builder.Build();
        host.ConfigurePipeline(_app);
        await _app.StartAsync(TestContext.Current.CancellationToken);
        _client = _app.GetTestClient();
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_app is not null)
        {
            await _app.DisposeAsync();
        }
    }

    private async Task<(HttpStatusCode Status, JsonElement Problem, string Text)> GetAsync(string path)
    {
        using var response = await _client!.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return (response.StatusCode, JsonDocument.Parse(text).RootElement.Clone(), text);
    }

    [Fact]
    public async Task A_domain_error_becomes_a_problem_with_its_own_type()
    {
        var (status, problem, _) = await GetAsync("/api/test/domain-error");

        Assert.Equal(HttpStatusCode.Conflict, status);
        Assert.Equal("https://tacticalboard/errors/last-admin", problem.GetProperty("type").GetString());
        Assert.Equal("Last Admin", problem.GetProperty("title").GetString());
        Assert.Equal(409, problem.GetProperty("status").GetInt32());
        Assert.Equal("The team needs at least one Admin.", problem.GetProperty("detail").GetString());
        Assert.Equal("/api/test/domain-error", problem.GetProperty("instance").GetString());
    }

    [Fact]
    public async Task An_unexpected_error_becomes_an_internal_error_problem_without_details()
    {
        var (status, problem, text) = await GetAsync("/api/test/crash");

        Assert.Equal(HttpStatusCode.InternalServerError, status);
        Assert.Equal("https://tacticalboard/errors/internal-error", problem.GetProperty("type").GetString());
        Assert.Equal(500, problem.GetProperty("status").GetInt32());
        Assert.DoesNotContain("secret internal detail", text, StringComparison.Ordinal);
        Assert.DoesNotContain("InvalidOperationException", text, StringComparison.Ordinal);
    }
}
