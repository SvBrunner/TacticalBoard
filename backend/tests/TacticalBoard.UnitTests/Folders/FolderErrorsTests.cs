using TacticalBoard.Folders.Contracts;
using TacticalBoard.Folders.Domain;
using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.UnitTests.Folders;

public class FolderErrorsTests
{
    [Fact]
    public void Not_found()
    {
        var id = Guid.NewGuid();
        var error = new FolderNotFoundException(id);

        Assert.Equal((DomainErrorKind.NotFound, "folder-not-found"), (error.Kind, error.Code));
        Assert.Contains(id.ToString(), error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Forbidden()
    {
        var error = new FolderAccessDeniedException();

        Assert.Equal((DomainErrorKind.Forbidden, "forbidden"), (error.Kind, error.Code));
    }

    [Fact]
    public void Duplicate_name_names_the_name()
    {
        var error = new DuplicateFolderNameException("Set pieces");

        Assert.Equal((DomainErrorKind.Conflict, "duplicate-folder-name"), (error.Kind, error.Code));
        Assert.Equal("A folder named \"Set pieces\" already exists here.", error.Message);
        Assert.Equal("Set pieces", error.Details["existingName"]);
    }

    [Fact]
    public void Not_empty_names_the_folder_and_says_what_to_do()
    {
        var error = new FolderNotEmptyException("Set pieces");

        Assert.Equal((DomainErrorKind.Conflict, "folder-not-empty"), (error.Kind, error.Code));
        Assert.Equal("The folder \"Set pieces\" still contains situations. Move or delete them first.", error.Message);
    }
}
