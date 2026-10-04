using System.Security.Claims;
using TacticalBoard.Api.Authentication;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.UnitTests.Api.Authentication;

public class ExternalLoginMapperTests
{
    private const string Issuer = "https://idp.example.org/realms/x";

    private static ClaimsPrincipal Principal(params (string Type, string Value)[] claims) =>
        new(new ClaimsIdentity(claims.Select(claim => new Claim(claim.Type, claim.Value, ClaimValueTypes.String, Issuer)), "oidc"));

    [Fact]
    public void Maps_issuer_subject_and_profile_claims()
    {
        var login = ExternalLoginMapper.Map(Principal(
            ("iss", Issuer), ("sub", "abc"), ("name", "Test Trainer"), ("preferred_username", "trainer"), ("email", "t@example.org")));

        Assert.Equal(new ExternalLogin(Issuer, "abc", "Test Trainer", "trainer", "t@example.org"), login);
    }

    [Fact]
    public void Leaves_missing_or_blank_profile_claims_empty()
    {
        var login = ExternalLoginMapper.Map(Principal(("iss", Issuer), ("sub", "abc"), ("name", " ")));

        Assert.Equal(new ExternalLogin(Issuer, "abc", null, null, null), login);
    }

    [Fact]
    public void Takes_the_issuer_from_the_subject_claim_without_an_iss_claim()
    {
        var login = ExternalLoginMapper.Map(Principal(("sub", "abc")));

        Assert.Equal(Issuer, login!.Issuer);
    }

    [Fact]
    public void Needs_a_subject()
    {
        Assert.Null(ExternalLoginMapper.Map(Principal(("iss", Issuer), ("name", "x"))));
        Assert.Null(ExternalLoginMapper.Map(Principal(("iss", Issuer), ("sub", " "))));
    }

    [Fact]
    public void Needs_a_real_issuer()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "abc")], "oidc"));

        Assert.Null(ExternalLoginMapper.Map(principal));
    }

    [Fact]
    public void Requires_a_principal() => Assert.Throws<ArgumentNullException>(() => ExternalLoginMapper.Map(null!));
}
