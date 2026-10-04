using TacticalBoard.SharedKernel.Errors;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.UnitTests.Situations;

public class SituationErrorsTests
{
    [Fact]
    public void Not_found()
    {
        var id = Guid.NewGuid();
        var error = new SituationNotFoundException(id);

        Assert.Equal((DomainErrorKind.NotFound, "situation-not-found"), (error.Kind, error.Code));
        Assert.Contains(id.ToString(), error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Forbidden()
    {
        var error = new SituationAccessDeniedException();

        Assert.Equal((DomainErrorKind.Forbidden, "forbidden"), (error.Kind, error.Code));
    }

    [Fact]
    public void Duplicate_title_names_the_title()
    {
        var error = new DuplicateSituationTitleException("Powerplay");

        Assert.Equal((DomainErrorKind.Conflict, "duplicate-title"), (error.Kind, error.Code));
        Assert.Equal("A situation titled \"Powerplay\" already exists here.", error.Message);
        Assert.Equal("Powerplay", error.Details["existingTitle"]);
    }

    [Fact]
    public void Save_conflict_carries_the_current_revision()
    {
        var error = new SituationSaveConflictException(8);

        Assert.Equal((DomainErrorKind.PreconditionFailed, "save-conflict"), (error.Kind, error.Code));
        Assert.Equal(8, error.CurrentRevision);
        Assert.Equal(8, error.Details["currentRevision"]);
    }
}
