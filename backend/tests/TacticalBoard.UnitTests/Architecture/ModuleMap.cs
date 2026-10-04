using System.Reflection;
using TacticalBoard.Areas;
using TacticalBoard.Folders;
using TacticalBoard.Infrastructure.Modularity;
using TacticalBoard.Situations;
using TacticalBoard.Teams;
using TacticalBoard.Users;

namespace TacticalBoard.UnitTests.Architecture;

/// <summary>The allowed dependencies between the modules (arc42 ch. 5.2, arrows = "uses").</summary>
internal static class ModuleMap
{
    public const string SharedKernel = "TacticalBoard.SharedKernel";
    public const string Infrastructure = "TacticalBoard.Infrastructure";

    public static readonly IReadOnlyDictionary<string, string[]> AllowedModuleDependencies = new Dictionary<string, string[]>
    {
        ["Users"] = [],
        ["Teams"] = ["Users"],
        ["Areas"] = ["Teams", "Users"],
        ["Folders"] = ["Areas"],
        ["Situations"] = ["Folders", "Areas"],
    };

    public static readonly IReadOnlyDictionary<string, Type> ModuleTypes = new Dictionary<string, Type>
    {
        ["Users"] = typeof(UsersModule),
        ["Teams"] = typeof(TeamsModule),
        ["Areas"] = typeof(AreasModule),
        ["Folders"] = typeof(FoldersModule),
        ["Situations"] = typeof(SituationsModule),
    };

    public static TheoryData<string> ModuleNames => new(AllowedModuleDependencies.Keys);

    public static Assembly AssemblyOf(string module) => ModuleTypes[module].Assembly;

    public static string AssemblyName(string module) => "TacticalBoard." + module;

    public static IModule Instance(string module) => (IModule)Activator.CreateInstance(ModuleTypes[module])!;
}
