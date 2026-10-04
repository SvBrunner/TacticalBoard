using NetArchTest.Rules;
using TacticalBoard.SharedKernel.Time;

namespace TacticalBoard.UnitTests.Architecture;

/// <summary>
/// Domain and application code depend only on abstractions (ADR-007); modules expose only their
/// module class and their <c>Contracts</c> namespace to other modules.
/// </summary>
public class LayeringTests
{
    private static readonly string[] InfrastructureNamespaces =
    [
        "Microsoft.EntityFrameworkCore",
        "Npgsql",
        "Microsoft.AspNetCore",
        "TacticalBoard.Infrastructure",
        "TacticalBoard.Api",
    ];

    private static string Failures(NetArchTest.Rules.TestResult result) =>
        string.Join(", ", result.FailingTypeNames ?? []);

    [Fact]
    public void The_dependency_rules_detect_a_violation()
    {
        // Guards the tooling itself: the infrastructure assembly does use EF Core, so the rule must fail.
        var result = Types.InAssembly(typeof(TacticalBoard.Infrastructure.Persistence.TacticalBoardDbContext).Assembly)
            .ShouldNot().HaveDependencyOnAny(InfrastructureNamespaces[0])
            .GetResult();

        Assert.False(result.IsSuccessful);
    }

    [Fact]
    public void Shared_kernel_depends_on_no_infrastructure()
    {
        var result = Types.InAssembly(typeof(IClock).Assembly).ShouldNot().HaveDependencyOnAny(InfrastructureNamespaces).GetResult();

        Assert.True(result.IsSuccessful, Failures(result));
    }

    [Fact]
    public void Shared_kernel_depends_on_no_module()
    {
        var modules = ModuleMap.ModuleTypes.Values.Select(type => type.Namespace!).ToArray();

        var result = Types.InAssembly(typeof(IClock).Assembly).ShouldNot().HaveDependencyOnAny(modules).GetResult();

        Assert.True(result.IsSuccessful, Failures(result));
    }

    [Theory]
    [MemberData(nameof(ModuleMap.ModuleNames), MemberType = typeof(ModuleMap))]
    public void Domain_and_application_code_depend_on_no_infrastructure(string module)
    {
        var result = Types.InAssembly(ModuleMap.AssemblyOf(module))
            .That().ResideInNamespace($"TacticalBoard.{module}.Domain")
            .Or().ResideInNamespace($"TacticalBoard.{module}.Application")
            .ShouldNot().HaveDependencyOnAny(InfrastructureNamespaces)
            .GetResult();

        Assert.True(result.IsSuccessful, Failures(result));
    }

    [Theory]
    [MemberData(nameof(ModuleMap.ModuleNames), MemberType = typeof(ModuleMap))]
    public void Modules_expose_only_the_module_class_and_their_contracts(string module)
    {
        var moduleType = ModuleMap.ModuleTypes[module];
        var contracts = $"TacticalBoard.{module}.Contracts";

        var exposed = moduleType.Assembly.GetExportedTypes()
            .Where(type => type != moduleType && type.Namespace != contracts && type.Namespace?.StartsWith(contracts + ".", StringComparison.Ordinal) != true)
            .Select(type => type.FullName);

        Assert.Empty(exposed);
    }

    [Theory]
    [MemberData(nameof(ModuleMap.ModuleNames), MemberType = typeof(ModuleMap))]
    public void The_module_class_implements_the_module_contract(string module) =>
        Assert.Equal(module, ModuleMap.Instance(module).Name);
}
