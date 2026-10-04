using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace TacticalBoard.IntegrationTests.TestSupport;

/// <summary>
/// A minimal standard OpenID Connect provider, in memory: discovery, JWKS, token (code + PKCE,
/// client secret), userinfo, and optionally an end-session endpoint. It is plugged in as the OIDC
/// handler's backchannel; the browser's visit to the authorization endpoint is simulated by
/// <see cref="Authorize"/>.
/// </summary>
internal sealed class FakeIdentityProvider : HttpMessageHandler
{
    public const string Issuer = "https://idp.test/realms/test";
    public const string ClientId = "tacticalboard-test";
    public const string ClientSecret = "test-secret";

    private const string AuthorizePath = "/realms/test/authorize";
    private const string TokenPath = "/realms/test/token";
    private const string UserInfoPath = "/realms/test/userinfo";
    private const string JwksPath = "/realms/test/jwks";
    private const string EndSessionPath = "/realms/test/logout";

    private readonly RSA _rsa = RSA.Create(2048);
    private readonly RsaSecurityKey _key;
    private readonly ConcurrentDictionary<string, PendingCode> _codes = new();
    private readonly ConcurrentDictionary<string, IReadOnlyDictionary<string, string>> _userInfo = new();

    private sealed record PendingCode(
        string Subject,
        IReadOnlyDictionary<string, string> Claims,
        string Nonce,
        string CodeChallenge,
        string RedirectUri);

    public FakeIdentityProvider() => _key = new RsaSecurityKey(_rsa) { KeyId = "test-key" };

    /// <summary>Whether discovery advertises an <c>end_session_endpoint</c>.</summary>
    public bool SupportsEndSession { get; set; } = true;

    /// <summary>When set, the profile claims are only in the userinfo response, not in the ID token.</summary>
    public bool ProfileClaimsInUserInfoOnly { get; set; }

    public static Uri EndSessionEndpoint => new("https://idp.test" + EndSessionPath);

    public static Uri AuthorizationEndpoint => new("https://idp.test" + AuthorizePath);

    /// <summary>
    /// What the IdP does when the browser arrives with <paramref name="authorizationRequest"/> and
    /// the user logs in as <paramref name="subject"/>: checks the request and returns the redirect
    /// back to the app (with code and state).
    /// </summary>
    public Uri Authorize(Uri authorizationRequest, string subject, IReadOnlyDictionary<string, string>? claims = null)
    {
        ArgumentNullException.ThrowIfNull(authorizationRequest);
        Assert.Equal(AuthorizationEndpoint.GetLeftPart(UriPartial.Path), authorizationRequest.GetLeftPart(UriPartial.Path));
        var query = QueryHelpers.ParseQuery(authorizationRequest.Query);
        Assert.Equal(ClientId, query["client_id"].ToString());
        Assert.Equal("code", query["response_type"].ToString());
        Assert.Equal("S256", query["code_challenge_method"].ToString());
        Assert.Contains("openid", query["scope"].ToString().Split(' '));

        var code = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(16));
        var redirectUri = query["redirect_uri"].ToString();
        _codes[code] = new PendingCode(
            subject,
            claims ?? new Dictionary<string, string>(),
            query["nonce"].ToString(),
            query["code_challenge"].ToString(),
            redirectUri);
        return new Uri(QueryHelpers.AddQueryString(redirectUri, new Dictionary<string, string?>
        {
            ["code"] = code,
            ["state"] = query["state"].ToString(),
        }));
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var path = request.RequestUri!.AbsolutePath;
        return path switch
        {
            "/realms/test/.well-known/openid-configuration" => Json(Discovery()),
            JwksPath => Json(Jwks()),
            TokenPath => await TokenAsync(request, cancellationToken),
            UserInfoPath => UserInfo(request),
            _ => new HttpResponseMessage(HttpStatusCode.NotFound),
        };
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _rsa.Dispose();
        }

        base.Dispose(disposing);
    }

    private Dictionary<string, object> Discovery()
    {
        var discovery = new Dictionary<string, object>
        {
            ["issuer"] = Issuer,
            ["authorization_endpoint"] = AuthorizationEndpoint.AbsoluteUri,
            ["token_endpoint"] = "https://idp.test" + TokenPath,
            ["userinfo_endpoint"] = "https://idp.test" + UserInfoPath,
            ["jwks_uri"] = "https://idp.test" + JwksPath,
            ["response_types_supported"] = new[] { "code" },
            ["subject_types_supported"] = new[] { "public" },
            ["id_token_signing_alg_values_supported"] = new[] { "RS256" },
            ["code_challenge_methods_supported"] = new[] { "S256" },
        };
        if (SupportsEndSession)
        {
            discovery["end_session_endpoint"] = EndSessionEndpoint.AbsoluteUri;
        }

        return discovery;
    }

    private Dictionary<string, object> Jwks()
    {
        var parameters = _rsa.ExportParameters(includePrivateParameters: false);
        return new Dictionary<string, object>
        {
            ["keys"] = new[]
            {
                new Dictionary<string, string>
                {
                    ["kty"] = "RSA",
                    ["use"] = "sig",
                    ["alg"] = "RS256",
                    ["kid"] = _key.KeyId,
                    ["n"] = Base64UrlEncoder.Encode(parameters.Modulus),
                    ["e"] = Base64UrlEncoder.Encode(parameters.Exponent),
                },
            },
        };
    }

    private async Task<HttpResponseMessage> TokenAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Assert.Equal(HttpMethod.Post, request.Method);
        var form = QueryHelpers.ParseQuery("?" + await request.Content!.ReadAsStringAsync(cancellationToken));
        Assert.Equal("authorization_code", form["grant_type"].ToString());
        Assert.Equal(ClientId, form["client_id"].ToString());
        Assert.Equal(ClientSecret, form["client_secret"].ToString());
        if (!_codes.TryRemove(form["code"].ToString(), out var pending))
        {
            return Json(new Dictionary<string, string> { ["error"] = "invalid_grant" }, HttpStatusCode.BadRequest);
        }

        Assert.Equal(pending.RedirectUri, form["redirect_uri"].ToString());
        var challenge = Base64UrlEncoder.Encode(SHA256.HashData(Encoding.ASCII.GetBytes(form["code_verifier"].ToString())));
        Assert.Equal(pending.CodeChallenge, challenge);

        var accessToken = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(16));
        _userInfo[accessToken] = new Dictionary<string, string>(pending.Claims) { ["sub"] = pending.Subject };

        var idTokenClaims = new Dictionary<string, object> { ["sub"] = pending.Subject, ["nonce"] = pending.Nonce };
        if (!ProfileClaimsInUserInfoOnly)
        {
            foreach (var (type, value) in pending.Claims)
            {
                idTokenClaims[type] = value;
            }
        }

        var now = DateTime.UtcNow;
        var idToken = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = Issuer,
            Audience = ClientId,
            IssuedAt = now,
            NotBefore = now,
            Expires = now.AddMinutes(5),
            Claims = idTokenClaims,
            SigningCredentials = new SigningCredentials(_key, SecurityAlgorithms.RsaSha256),
        });

        return Json(new Dictionary<string, object>
        {
            ["access_token"] = accessToken,
            ["token_type"] = "Bearer",
            ["expires_in"] = 300,
            ["id_token"] = idToken,
        });
    }

    private HttpResponseMessage UserInfo(HttpRequestMessage request)
    {
        var token = request.Headers.Authorization is { Scheme: "Bearer" } authorization ? authorization.Parameter : null;
        return token is not null && _userInfo.TryGetValue(token, out var claims)
            ? Json(claims)
            : new HttpResponseMessage(HttpStatusCode.Unauthorized);
    }

    private static HttpResponseMessage Json(object body, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, new MediaTypeHeaderValue("application/json")),
        };
}

/// <summary>Claim sets for test logins.</summary>
internal static class TestClaims
{
    public static IReadOnlyDictionary<string, string> Profile(string? name = null, string? preferredUsername = null, string? email = null)
    {
        var claims = new Dictionary<string, string>();
        if (name is not null)
        {
            claims["name"] = name;
        }

        if (preferredUsername is not null)
        {
            claims["preferred_username"] = preferredUsername;
        }

        if (email is not null)
        {
            claims["email"] = email;
        }

        return claims;
    }
}
