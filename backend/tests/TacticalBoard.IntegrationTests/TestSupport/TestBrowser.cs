using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace TacticalBoard.IntegrationTests.TestSupport;

/// <summary>An HTTP client acting like the browser: cookies, manual redirects, the login round trip through the IdP.</summary>
internal sealed class TestBrowser(HttpClient client, FakeIdentityProvider identityProvider) : IDisposable
{
    public HttpClient Client { get; } = client;

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    /// <summary>Logs in as <paramref name="subject"/>; returns the final response of the callback (a redirect).</summary>
    public async Task<HttpResponseMessage> LoginAsync(
        string subject,
        IReadOnlyDictionary<string, string>? claims = null,
        string returnUrl = "/")
    {
        using var login = await GetAsync("/auth/login?returnUrl=" + Uri.EscapeDataString(returnUrl));
        Assert.Equal(HttpStatusCode.Redirect, login.StatusCode);
        var callback = identityProvider.Authorize(login.Headers.Location!, subject, claims);
        return await GetAsync(callback.PathAndQuery);
    }

    /// <summary>Logs in and checks that it worked.</summary>
    public async Task LoginSuccessfullyAsync(string subject, IReadOnlyDictionary<string, string>? claims = null)
    {
        using var response = await LoginAsync(subject, claims);
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/", response.Headers.Location?.OriginalString);
    }

    public Task<HttpResponseMessage> GetAsync(string path) => Client.GetAsync(new Uri(path, UriKind.Relative), Cancellation);

    /// <summary>A fresh antiforgery request token for the current session.</summary>
    public async Task<string> AntiforgeryTokenAsync()
    {
        using var response = await GetAsync("/api/antiforgery");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Cancellation);
        return body.GetProperty("token").GetString()!;
    }

    /// <summary><c>GET /api/me</c> as JSON (asserting 200).</summary>
    public async Task<JsonElement> MeAsync()
    {
        using var response = await GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Cancellation);
    }

    /// <summary><c>PUT /api/me/display-name</c>, with the antiforgery header if <paramref name="antiforgeryToken"/> is given.</summary>
    public async Task<HttpResponseMessage> ChangeDisplayNameAsync(object body, string? antiforgeryToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, new Uri("/api/me/display-name", UriKind.Relative))
        {
            Content = JsonContent.Create(body),
        };
        if (antiforgeryToken is not null)
        {
            request.Headers.Add("X-CSRF-TOKEN", antiforgeryToken);
        }

        return await Client.SendAsync(request, Cancellation);
    }

    /// <summary><c>POST /auth/logout</c> as the logout form does it (form field), if <paramref name="antiforgeryToken"/> is given.</summary>
    public async Task<HttpResponseMessage> LogoutAsync(string? antiforgeryToken)
    {
        var fields = new Dictionary<string, string>();
        if (antiforgeryToken is not null)
        {
            fields["__RequestVerificationToken"] = antiforgeryToken;
        }

        using var content = new FormUrlEncodedContent(fields);
        return await Client.PostAsync(new Uri("/auth/logout", UriKind.Relative), content, Cancellation);
    }

    public void Dispose() => Client.Dispose();
}
