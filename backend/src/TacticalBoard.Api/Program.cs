using TacticalBoard.Api.Hosting;

var builder = WebApplication.CreateBuilder(args);
var host = new ApiHost(ModuleCatalog.All);
host.ConfigureServices(builder.Services, builder.Configuration);

var app = builder.Build();
host.ConfigurePipeline(app);
await app.RunAsync();

/// <summary>The entry point; public so integration tests can start the app (WebApplicationFactory).</summary>
public partial class Program;
