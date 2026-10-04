using TacticalBoard.Users.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Users;

public class UserTests
{
    private static readonly Guid Id = Guid.Parse("0199a6d0-0000-7000-8000-000000000001");
    private static readonly DateTimeOffset CreatedAt = new(2026, 10, 4, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Registers_a_normal_user()
    {
        var user = User.Register(Id, TestUsers.Identity("alice"), DisplayName.FromTrusted("Alice"), CreatedAt);

        Assert.Equal(Id, user.Id);
        Assert.Equal(TestUsers.Identity("alice"), user.Identity);
        Assert.Equal(TestUsers.Issuer, user.Issuer);
        Assert.Equal("alice", user.Subject);
        Assert.Equal("Alice", user.DisplayName.Value);
        Assert.Equal(CreatedAt, user.CreatedAt);
        Assert.False(user.IsSystemAdministrator);
        Assert.False(user.IsBlocked);
        Assert.False(user.IsDeleted);
        Assert.True(user.CanSignIn);
    }

    [Fact]
    public void Requires_an_id_identity_and_name()
    {
        Assert.Throws<ArgumentException>(() => User.Register(Guid.Empty, TestUsers.Identity(), DisplayName.FromTrusted("A"), CreatedAt));
        Assert.Throws<ArgumentNullException>(() => User.Register(Id, null!, DisplayName.FromTrusted("A"), CreatedAt));
        Assert.Throws<ArgumentNullException>(() => User.Register(Id, TestUsers.Identity(), null!, CreatedAt));
    }

    [Fact]
    public void Changes_the_display_name()
    {
        var user = TestUsers.Create();

        user.ChangeDisplayName(DisplayName.FromTrusted("Coach"));

        Assert.Equal("Coach", user.DisplayName.Value);
        Assert.Equal("Coach", user.DisplayNameValue);
        Assert.Throws<ArgumentNullException>(() => user.ChangeDisplayName(null!));
    }

    [Fact]
    public void Has_no_language_until_it_is_chosen()
    {
        var user = TestUsers.Create();
        Assert.Null(user.PreferredLanguage);
        Assert.Null(user.PreferredLanguageValue);

        user.ChangePreferredLanguage(LanguageTag.FromTrusted("de"));

        Assert.Equal("de", user.PreferredLanguage?.Value);
        Assert.Equal("de", user.PreferredLanguageValue);
        Assert.Throws<ArgumentNullException>(() => user.ChangePreferredLanguage(null!));
    }

    [Fact]
    public void Can_become_system_administrator()
    {
        var user = TestUsers.Create();

        user.GrantSystemAdministrator();

        Assert.True(user.IsSystemAdministrator);
    }

    [Fact]
    public void A_blocked_user_cannot_sign_in()
    {
        var user = TestUsers.Create();

        user.Block();

        Assert.True(user.IsBlocked);
        Assert.False(user.CanSignIn);
    }

    [Fact]
    public void A_deleted_user_cannot_sign_in()
    {
        var user = TestUsers.Create();

        user.MarkDeleted(CreatedAt);

        Assert.False(user.CanSignIn);
    }
}
