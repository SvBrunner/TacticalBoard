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

    [Fact]
    public void Forbidden_may_say_why()
    {
        var error = new TeamAccessDeniedException("Only the team's Admins may delete it.");

        Assert.Equal((DomainErrorKind.Forbidden, "forbidden", "Only the team's Admins may delete it."), (error.Kind, error.Code, error.Message));
    }

    [Fact]
    public void Last_Admin_is_a_conflict()
    {
        var error = new LastTeamAdminException();

        Assert.Equal((DomainErrorKind.Conflict, "last-team-admin"), (error.Kind, error.Code));
        Assert.Contains("at least one Admin", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Member_not_found_names_the_user()
    {
        var userId = Guid.NewGuid();
        var error = new TeamMemberNotFoundException(userId);

        Assert.Equal((DomainErrorKind.NotFound, "team-member-not-found"), (error.Kind, error.Code));
        Assert.Contains(userId.ToString(), error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Join_request_errors()
    {
        var requestId = Guid.NewGuid();

        Assert.Equal((DomainErrorKind.NotFound, "join-request-not-found"), (new JoinRequestNotFoundException(requestId).Kind, new JoinRequestNotFoundException(requestId).Code));
        Assert.Contains(requestId.ToString(), new JoinRequestNotFoundException(requestId).Message, StringComparison.Ordinal);
        Assert.Equal((DomainErrorKind.Conflict, "already-team-member"), (new AlreadyTeamMemberException().Kind, new AlreadyTeamMemberException().Code));
        Assert.Equal((DomainErrorKind.Conflict, "join-request-pending"), (new JoinRequestPendingException().Kind, new JoinRequestPendingException().Code));
    }
}
