using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using TacticalBoard.Api.Authentication;

namespace TacticalBoard.UnitTests.Api.Authentication;

public class DiscoveryEndSessionSupportTests
{
    private sealed class FakeConfigurationManager(Func<OpenIdConnectConfiguration> configuration) : IConfigurationManager<OpenIdConnectConfiguration>
    {
        public Task<OpenIdConnectConfiguration> GetConfigurationAsync(CancellationToken cancel) => Task.FromResult(configuration());

        public void RequestRefresh()
        {
        }
    }

    private sealed class Monitor(OpenIdConnectOptions options) : IOptionsMonitor<OpenIdConnectOptions>
    {
        public OpenIdConnectOptions CurrentValue => options;

        public OpenIdConnectOptions Get(string? name) => name == OpenIdConnectDefaults.AuthenticationScheme ? options : new OpenIdConnectOptions();

        public IDisposable? OnChange(Action<OpenIdConnectOptions, string?> listener) => null;
    }

    private static Task<bool> IsSupportedAsync(IConfigurationManager<OpenIdConnectConfiguration>? manager) =>
        new DiscoveryEndSessionSupport(new Monitor(new OpenIdConnectOptions { ConfigurationManager = manager }), NullLogger<DiscoveryEndSessionSupport>.Instance)
            .IsSupportedAsync(TestContext.Current.CancellationToken);

    [Fact]
    public async Task Is_supported_when_discovery_has_an_end_session_endpoint() =>
        Assert.True(await IsSupportedAsync(new FakeConfigurationManager(() => new OpenIdConnectConfiguration { EndSessionEndpoint = "https://idp/logout" })));

    [Fact]
    public async Task Is_not_supported_without_an_end_session_endpoint() =>
        Assert.False(await IsSupportedAsync(new FakeConfigurationManager(() => new OpenIdConnectConfiguration())));

    [Fact]
    public async Task Is_not_supported_when_discovery_fails() =>
        Assert.False(await IsSupportedAsync(new FakeConfigurationManager(() => throw new InvalidOperationException("IdP down"))));

    [Fact]
    public async Task Is_not_supported_without_a_configuration_manager() =>
        Assert.False(await IsSupportedAsync(null));
}
