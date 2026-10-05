using TacticalBoard.SharedKernel.Errors;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.UnitTests.Teams;

public class TeamErrorsTests
{
    [Fact]
    public void Not_found_names_the_code()
    {
        var error = new TeamNotFoundException("ABC123");

        Assert.Equal((DomainErrorKind.NotFound, "team-not-found"), (error.Kind, error.Code));
        Assert.Contains("ABC123", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Logo_not_found()
    {
        var error = new TeamLogoNotFoundException("ABC123");

        Assert.Equal((DomainErrorKind.NotFound, "team-logo-not-found"), (error.Kind, error.Code));
    }

    [Fact]
    public void Forbidden()
    {
        var error = new TeamAccessDeniedException();

        Assert.Equal((DomainErrorKind.Forbidden, "forbidden"), (error.Kind, error.Code));
    }

    [Fact]
    public void Duplicate_name_names_the_name()
    {
        var error = new DuplicateTeamNameException("Lions");

        Assert.Equal((DomainErrorKind.Conflict, "duplicate-team-name"), (error.Kind, error.Code));
        Assert.Equal("A team named \"Lions\" already exists.", error.Message);
        Assert.Equal("Lions", error.Details["existingName"]);
    }
}
