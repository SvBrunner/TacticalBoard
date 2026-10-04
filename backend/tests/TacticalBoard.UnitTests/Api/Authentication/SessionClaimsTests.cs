using System.Security.Claims;
using TacticalBoard.Api.Authentication;

namespace TacticalBoard.UnitTests.Api.Authentication;

public class SessionClaimsTests
{
    private static readonly Guid UserId = Guid.Parse("0199a6d0-0000-7000-8000-000000000001");

    [Fact]
    public void Creates_an_authenticated_principal_with_only_the_user_id()
    {
        var principal = SessionClaims.CreatePrincipal(UserId);

        Assert.True(principal.Identity!.IsAuthenticated);
        Assert.Equal(SessionClaims.AuthenticationType, principal.Identity.AuthenticationType);
        var claim = Assert.Single(principal.Claims);
        Assert.Equal(SessionClaims.UserIdClaimType, claim.Type);
        Assert.Equal(UserId.ToString(), claim.Value);
    }

    [Fact]
    public void Reads_the_user_id_back() => Assert.Equal(UserId, SessionClaims.UserId(SessionClaims.CreatePrincipal(UserId)));

    [Fact]
    public void Has_no_user_id_without_the_claim()
    {
        Assert.Null(SessionClaims.UserId(null));
        Assert.Null(SessionClaims.UserId(new ClaimsPrincipal(new ClaimsIdentity())));
        Assert.Null(SessionClaims.UserId(new ClaimsPrincipal(new ClaimsIdentity([new Claim(SessionClaims.UserIdClaimType, "not-a-guid")]))));
    }
}
