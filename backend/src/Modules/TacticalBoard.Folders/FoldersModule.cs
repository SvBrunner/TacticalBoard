using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Folders.Application;
using TacticalBoard.Folders.Contracts;
using TacticalBoard.Folders.Endpoints;
using TacticalBoard.Folders.Infrastructure;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Modularity;

namespace TacticalBoard.Folders;

/// <summary>
/// The Folders module: flat folders inside an area (create, rename, delete when empty). Provides
/// <see cref="IFolderDirectory"/> to Situations; needs an <see cref="IFolderContents"/>, which
/// the Situations module registers.
/// </summary>
public sealed class FoldersModule : IModule
{
    /// <inheritdoc />
    public string Name => "Folders";

    /// <inheritdoc />
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModelConfigurationFrom(typeof(FoldersModule).Assembly);
        services.AddScoped<IFolderRepository, EfFolderRepository>();
        services.AddScoped<IFolderDirectory, FolderDirectory>();
        services.AddScoped<FolderService>();
    }

    /// <inheritdoc />
    public void MapEndpoints(IEndpointRouteBuilder api) => FolderEndpoints.Map(api);
}
