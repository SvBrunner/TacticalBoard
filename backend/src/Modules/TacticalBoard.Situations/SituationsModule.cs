using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Contracts;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Modularity;
using TacticalBoard.Situations.Application;
using TacticalBoard.Situations.Endpoints;
using TacticalBoard.Situations.Infrastructure;

namespace TacticalBoard.Situations;

/// <summary>
/// The Situations module: situations with their revisions, saving with conflict detection, title uniqueness and default titles, validation of the situation document, moving between the folders of an area. Implements Folders' <see cref="IFolderContents"/> and Areas' <see cref="IAreaContentDeletion"/> (a deleted team's situations go with it).
/// </summary>
public sealed class SituationsModule : IModule
{
    /// <inheritdoc />
    public string Name => "Situations";

    /// <inheritdoc />
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModelConfigurationFrom(typeof(SituationsModule).Assembly);
        services.AddScoped<ISituationRepository, EfSituationRepository>();
        services.AddScoped<SituationService>();
        services.AddScoped<IFolderContents, SituationFolderContents>();
        services.AddScoped<IAreaContentDeletion, SituationAreaContentDeletion>();
    }

    /// <inheritdoc />
    public void MapEndpoints(IEndpointRouteBuilder api) => SituationEndpoints.Map(api);
}
