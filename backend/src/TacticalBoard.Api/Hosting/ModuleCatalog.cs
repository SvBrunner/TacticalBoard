using TacticalBoard.Areas;
using TacticalBoard.Folders;
using TacticalBoard.Infrastructure.Modularity;
using TacticalBoard.Situations;
using TacticalBoard.Teams;
using TacticalBoard.Users;

namespace TacticalBoard.Api.Hosting;

/// <summary>The business modules of the backend (arc42 ch. 5.2), in dependency order.</summary>
public static class ModuleCatalog
{
    /// <summary>All modules: Users, Teams, Areas, Folders, Situations.</summary>
    public static IReadOnlyList<IModule> All { get; } =
    [
        new UsersModule(),
        new TeamsModule(),
        new AreasModule(),
        new FoldersModule(),
        new SituationsModule(),
    ];
}
