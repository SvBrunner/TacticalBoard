using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.UnitTests.Teams;

public class TeamPermissionsTests
{
    [Theory]
    [InlineData(TeamRole.Admin, "ChangeDetails", true)]
    [InlineData(TeamRole.Admin, "SeeMembers", true)]
    [InlineData(TeamRole.Admin, "ManageMembers", true)]
    [InlineData(TeamRole.Admin, "DecideJoinRequests", true)]
    [InlineData(TeamRole.Admin, "Leave", true)]
    [InlineData(TeamRole.Admin, "DeleteTeam", true)]
    [InlineData(TeamRole.Editor, "ChangeDetails", false)]
    [InlineData(TeamRole.Editor, "SeeMembers", true)]
    [InlineData(TeamRole.Editor, "ManageMembers", false)]
    [InlineData(TeamRole.Editor, "DecideJoinRequests", false)]
    [InlineData(TeamRole.Editor, "Leave", true)]
    [InlineData(TeamRole.Editor, "DeleteTeam", false)]
    [InlineData(TeamRole.Reader, "ChangeDetails", false)]
    [InlineData(TeamRole.Reader, "SeeMembers", true)]
    [InlineData(TeamRole.Reader, "ManageMembers", false)]
    [InlineData(TeamRole.Reader, "DecideJoinRequests", false)]
    [InlineData(TeamRole.Reader, "Leave", true)]
    [InlineData(TeamRole.Reader, "DeleteTeam", false)]
    [InlineData(TeamRole.Admin, "ReadContent", true)]
    [InlineData(TeamRole.Admin, "WriteContent", true)]
    [InlineData(TeamRole.Editor, "ReadContent", true)]
    [InlineData(TeamRole.Editor, "WriteContent", true)]
    [InlineData(TeamRole.Reader, "ReadContent", true)]
    [InlineData(TeamRole.Reader, "WriteContent", false)]
    public void Follow_the_matrix(TeamRole role, string permission, bool allowed) =>
        Assert.Equal(allowed, TeamPermissions.Allows(role, Enum.Parse<TeamPermission>(permission)));

    [Fact]
    public void Non_members_may_nothing() =>
        Assert.All(Enum.GetValues<TeamPermission>(), permission => Assert.False(TeamPermissions.Allows(null, permission)));
}
