using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamMemberNamesTests
{
    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Looks_up_display_names_once_and_misses_deleted_users()
    {
        var alice = Guid.NewGuid();
        var users = new FakeUserDirectory(new Dictionary<Guid, string> { [alice] = "Alice" });
        var names = new TeamMemberNames(users);

        var found = await names.OfAsync([alice, alice, Guid.NewGuid()], Cancellation);

        Assert.Equal(new Dictionary<Guid, string> { [alice] = "Alice" }, found);
        Assert.Equal("Alice", await names.OfAsync(alice, Cancellation));
        Assert.Null(await names.OfAsync(Guid.NewGuid(), Cancellation));
        Assert.Equal(3, users.Queries);
    }

    [Fact]
    public void Orders_members_by_name_ignoring_case_and_deleted_users_last()
    {
        var at = DateTimeOffset.UnixEpoch;
        var first = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var second = Guid.Parse("00000000-0000-0000-0000-000000000002");
        TeamMemberView Member(Guid id, string? name) => new(id, name, TeamRole.Reader, at);

        var ordered = TeamMemberNames.Ordered([Member(second, null), Member(Guid.NewGuid(), "bob"), Member(Guid.NewGuid(), "Anna"), Member(first, null), Member(Guid.NewGuid(), "Bob")]);

        Assert.Equal(["Anna", "Bob", "bob", null, null], ordered.Select(member => member.DisplayName));
        Assert.Equal([first, second], ordered.Skip(3).Select(member => member.UserId));
    }

    [Fact]
    public void Orders_members_by_role_first_then_by_name_with_deleted_users_last_within_the_role()
    {
        var at = DateTimeOffset.UnixEpoch;
        TeamMemberView Member(string? name, TeamRole role) => new(Guid.NewGuid(), name, role, at);

        var ordered = TeamMemberNames.Ordered(
        [
            Member("Anna", TeamRole.Reader),
            Member(null, TeamRole.Admin),
            Member("Zoe", TeamRole.Admin),
            Member("bob", TeamRole.Editor),
            Member("Carl", TeamRole.Admin),
            Member(null, TeamRole.Reader),
            Member("Al", TeamRole.Editor),
        ]);

        Assert.Equal(
            [("Carl", TeamRole.Admin), ("Zoe", TeamRole.Admin), (null, TeamRole.Admin), ("Al", TeamRole.Editor), ("bob", TeamRole.Editor), ("Anna", TeamRole.Reader), (null, TeamRole.Reader)],
            ordered.Select(member => (member.DisplayName, member.Role)));
    }

    [Fact]
    public void Refuses_an_unknown_role()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => TeamMemberNames.Ordered([new TeamMemberView(Guid.NewGuid(), "X", (TeamRole)42, DateTimeOffset.UnixEpoch), new TeamMemberView(Guid.NewGuid(), "Y", TeamRole.Admin, DateTimeOffset.UnixEpoch)]));
    }
}
