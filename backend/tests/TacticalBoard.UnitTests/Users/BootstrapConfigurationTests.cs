using Microsoft.Extensions.Configuration;
using TacticalBoard.Users.Infrastructure;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Users;

public class BootstrapConfigurationTests
{
    private static IConfiguration Configuration(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    [Fact]
    public void Is_empty_without_configuration() =>
        Assert.Empty(BootstrapConfiguration.Read(Configuration([])).Identities);

    [Fact]
    public void Reads_one_entry()
    {
        var configured = BootstrapConfiguration.Read(Configuration(new() { ["Bootstrap:SystemAdministrators"] = TestUsers.Issuer + "|alice" }));

        Assert.True(configured.Contains(TestUsers.Identity("alice")));
    }

    [Fact]
    public void Reads_several_entries_from_one_value()
    {
        var configured = BootstrapConfiguration.Read(Configuration(new()
        {
            ["Bootstrap:SystemAdministrators"] = $"{TestUsers.Issuer}|alice; {TestUsers.Issuer}|bob\n{TestUsers.Issuer}|carol;",
        }));

        Assert.Equal(3, configured.Identities.Count);
        Assert.True(configured.Contains(TestUsers.Identity("bob")));
        Assert.True(configured.Contains(TestUsers.Identity("carol")));
    }

    [Fact]
    public void Reads_a_list()
    {
        var configured = BootstrapConfiguration.Read(Configuration(new()
        {
            ["Bootstrap:SystemAdministrators:0"] = TestUsers.Issuer + "|alice",
            ["Bootstrap:SystemAdministrators:1"] = TestUsers.Issuer + "|bob",
        }));

        Assert.Equal(2, configured.Identities.Count);
    }

    [Fact]
    public void Fails_on_a_malformed_entry()
    {
        var thrown = Assert.Throws<InvalidOperationException>(() =>
            BootstrapConfiguration.Read(Configuration(new() { ["Bootstrap:SystemAdministrators"] = "just-a-subject" })));

        Assert.Contains("Bootstrap__SystemAdministrators", thrown.Message, StringComparison.Ordinal);
    }
}
