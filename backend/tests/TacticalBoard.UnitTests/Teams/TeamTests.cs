using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");

    [Fact]
    public void Is_created_with_name_code_and_creator_and_without_logo()
    {
        var id = Guid.NewGuid();

        var team = Team.Create(id, TestTeams.Name(" Lions "), TeamCode.Parse("abc123"), TestTeams.Now, Alice);

        Assert.Equal((id, "Lions", "LIONS", "ABC123"), (team.Id, team.Name, team.NormalizedName, team.Code));
        Assert.Equal((TestTeams.Now, Alice, TestTeams.Now, Alice), (team.CreatedAt, team.CreatedBy, team.UpdatedAt, team.UpdatedBy));
        Assert.Null(team.LogoHash);
        Assert.False(team.HasLogo);
        Assert.False(team.IsDeleted);
    }

    [Fact]
    public void Needs_an_id()
    {
        Assert.Throws<ArgumentException>(() => Team.Create(Guid.Empty, TestTeams.Name("Lions"), TeamCode.Parse("ABC123"), TestTeams.Now, Alice));
    }

    [Fact]
    public void Rename_changes_the_name_and_who_changed_it()
    {
        var team = TestTeams.Team("Lions", creator: Alice);
        var later = TestTeams.Now.AddHours(1);

        team.Rename(TestTeams.Name("Tigers"), later, Bob);

        Assert.Equal(("Tigers", "TIGERS", later, Bob), (team.Name, team.NormalizedName, team.UpdatedAt, team.UpdatedBy));
        Assert.Equal((TestTeams.Now, Alice), (team.CreatedAt, team.CreatedBy));
    }

    [Fact]
    public void Records_the_current_logo_by_its_hash()
    {
        var team = TestTeams.Team();
        var logo = TestTeams.Logo();
        var later = TestTeams.Now.AddMinutes(5);

        team.ChangeLogo(logo, later, Bob);
        Assert.Equal((logo.Hash, true, later, Bob), (team.LogoHash, team.HasLogo, team.UpdatedAt, team.UpdatedBy));

        team.ChangeLogo(null, later.AddMinutes(1), Alice);
        Assert.Equal((null, false, Alice), (team.LogoHash, team.HasLogo, team.UpdatedBy));
    }

    [Fact]
    public void Its_creator_becomes_its_Admin()
    {
        var team = TestTeams.Team(creator: Alice);
        var id = Guid.NewGuid();

        var membership = TeamMembership.ForCreator(id, team);

        Assert.Equal((id, team.Id, Alice, TeamRole.Admin, TestTeams.Now), (membership.Id, membership.TeamId, membership.UserId, membership.Role, membership.JoinedAt));
        Assert.False(membership.IsDeleted);
        Assert.Throws<ArgumentException>(() => TeamMembership.ForCreator(Guid.Empty, team));
    }

    [Fact]
    public void Is_soft_deleted_once_and_records_who_deleted_it()
    {
        var team = TestTeams.Team(creator: Alice);
        var later = TestTeams.Now.AddHours(1);

        team.Delete(later, Bob);
        team.Delete(later.AddHours(1), Alice);

        Assert.True(team.IsDeleted);
        Assert.Equal((later, later, Bob), (team.DeletedAt, team.UpdatedAt, team.UpdatedBy));
    }
}
