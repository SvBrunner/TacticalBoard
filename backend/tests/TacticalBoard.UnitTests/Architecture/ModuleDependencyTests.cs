using System.Xml.Linq;

namespace TacticalBoard.UnitTests.Architecture;

/// <summary>
/// Enforces the module dependency directions of arc42 ch. 5.2, both in the project files (what a
/// module may use) and in the compiled assemblies (what it does use).
/// </summary>
public class ModuleDependencyTests
{
    private static readonly DirectoryInfo BackendRoot = FindBackendRoot();

    private static DirectoryInfo FindBackendRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "TacticalBoard.slnx")))
        {
            directory = directory.Parent;
        }

        return directory ?? throw new InvalidOperationException("Backend root (TacticalBoard.slnx) not found.");
    }

    private static List<string> ProjectReferences(string module)
    {
        var projectFile = Path.Combine(BackendRoot.FullName, "src", "Modules", ModuleMap.AssemblyName(module), ModuleMap.AssemblyName(module) + ".csproj");
        return XDocument.Load(projectFile)
            .Descendants("ProjectReference")
            .Select(reference => Path.GetFileNameWithoutExtension(reference.Attribute("Include")!.Value.Replace('\\', '/')))
            .ToList();
    }

    [Theory]
    [MemberData(nameof(ModuleMap.ModuleNames), MemberType = typeof(ModuleMap))]
    public void Module_projects_reference_exactly_the_modules_they_may_use(string module)
    {
        var expected = ModuleMap.AllowedModuleDependencies[module].Select(ModuleMap.AssemblyName).Order();

        Assert.Equal(expected, ProjectReferences(module).Order());
    }

    [Fact]
    public void Module_projects_do_not_inherit_transitive_references()
    {
        var props = XDocument.Load(Path.Combine(BackendRoot.FullName, "src", "Modules", "Directory.Build.props"));

        Assert.Equal("true", props.Descendants("DisableTransitiveProjectReferences").Single().Value);
    }

    [Theory]
    [MemberData(nameof(ModuleMap.ModuleNames), MemberType = typeof(ModuleMap))]
    public void Module_assemblies_use_only_allowed_modules(string module)
    {
        var allowed = ModuleMap.AllowedModuleDependencies[module]
            .Select(ModuleMap.AssemblyName)
            .Append(ModuleMap.SharedKernel)
            .Append(ModuleMap.Infrastructure)
            .ToHashSet();

        var used = ModuleMap.AssemblyOf(module).GetReferencedAssemblies()
            .Select(reference => reference.Name!)
            .Where(name => name.StartsWith("TacticalBoard.", StringComparison.Ordinal));

        Assert.All(used, name => Assert.Contains(name, allowed));
    }

    [Fact]
    public void The_module_graph_has_no_cycles()
    {
        var visiting = new HashSet<string>();
        var done = new HashSet<string>();

        void Visit(string module)
        {
            Assert.True(visiting.Add(module), $"Cycle through module {module}.");
            foreach (var dependency in ModuleMap.AllowedModuleDependencies[module].Where(dependency => !done.Contains(dependency)))
            {
                Visit(dependency);
            }

            visiting.Remove(module);
            done.Add(module);
        }

        foreach (var module in ModuleMap.AllowedModuleDependencies.Keys)
        {
            Visit(module);
        }

        Assert.Equal(ModuleMap.AllowedModuleDependencies.Count, done.Count);
    }

    [Fact]
    public void Users_depends_on_no_other_module() =>
        Assert.Empty(ModuleMap.AllowedModuleDependencies["Users"]);
}
