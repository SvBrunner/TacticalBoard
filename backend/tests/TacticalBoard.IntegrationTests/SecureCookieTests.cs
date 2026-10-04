using System.Net;
using TacticalBoard.IntegrationTests.TestSupport;

namespace TacticalBoard.IntegrationTests;

/// <summary>
/// With the default (secure) cookie setting every cookie is Secure and uses the <c>__Host-</c>
/// prefix. Behind a TLS-terminating reverse proxy the backend sees plain http, so it has to trust
/// <c>X-Forwarded-Proto</c> (<c>ASPNETCORE_FORWARDEDHEADERS_ENABLED=true</c>, arc42 ch. 7).
/// </summary>
public sealed class SecureCookieTests(PostgresFixture postgres)
{
    private static readonly Dictionary<string, string?> Secure = new() { ["Session:SecureCookies"] = "true" };

    private static List<string> Cookies(params HttpResponseMessage[] responses) =>
        responses.SelectMany(response => response.Headers.TryGetValues("Set-Cookie", out var values) ? values : []).ToList();

    [Fact]
    public async Task Session_and_antiforgery_cookies_are_secure_by_default()
    {
        await using var factory = ApiFactory.WithDatabase(postgres.NewDatabaseConnectionString(), settings: Secure);
        using var browser = factory.CreateBrowser(new Uri("https://localhost"));

        using var antiforgery = await browser.GetAsync("/api/antiforgery");
        using var login = await browser.GetAsync("/auth/login");

        Assert.Equal(HttpStatusCode.OK, antiforgery.StatusCode);
        var cookies = Cookies(antiforgery, login);
        Assert.Contains(cookies, cookie => cookie.StartsWith("__Host-tb_antiforgery=", StringComparison.Ordinal));
        Assert.True(cookies.Count >= 3, string.Join(" | ", cookies));
        Assert.All(cookies, cookie => Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Behind_a_tls_proxy_the_forwarded_scheme_is_trusted_when_enabled()
    {
        var settings = new Dictionary<string, string?>(Secure) { ["FORWARDEDHEADERS_ENABLED"] = "true" };
        await using var factory = ApiFactory.WithDatabase(postgres.NewDatabaseConnectionString(), settings: settings);
        using var browser = factory.CreateBrowser();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/api/antiforgery", UriKind.Relative));
        request.Headers.Add("X-Forwarded-Proto", "https");

        using var response = await browser.Client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.All(Cookies(response), cookie => Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase));
    }
}
