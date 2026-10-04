using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Domain;

namespace TacticalBoard.UnitTests.Folders;

public class FolderTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");
    private static readonly Guid Id = Guid.Parse("0199a6d0-0000-7000-8000-0000000000f1");
    private static readonly DateTimeOffset Created = new(2026, 10, 4, 8, 0, 0, TimeSpan.Zero);

    internal static FolderName Name(string text)
    {
        Assert.True(FolderName.TryCreate(text, out var name, out _));
        return name;
    }

    [Fact]
    public void Creating_sets_the_area_name_and_metadata()
    {
        var folder = Folder.Create(Id, AreaReference.Personal(Alice), Name(" Set pieces "), Created, Alice);

        Assert.Equal(Id, folder.Id);
        Assert.Equal(AreaReference.Personal(Alice), folder.Area);
        Assert.Equal(("Set pieces", "SET PIECES"), (folder.Name, folder.NormalizedName));
        Assert.Equal((Created, Alice, Created, Alice), (folder.CreatedAt, folder.CreatedBy, folder.UpdatedAt, folder.UpdatedBy));
        Assert.False(folder.IsDeleted);
    }

    [Fact]
    public void Renaming_changes_the_name_and_the_last_change()
    {
        var folder = Folder.Create(Id, AreaReference.Personal(Alice), Name("Set pieces"), Created, Alice);

        folder.Rename(Name("Breakouts"), Created.AddHours(1), Bob);

        Assert.Equal(("Breakouts", "BREAKOUTS"), (folder.Name, folder.NormalizedName));
        Assert.Equal((Created, Alice, Created.AddHours(1), Bob), (folder.CreatedAt, folder.CreatedBy, folder.UpdatedAt, folder.UpdatedBy));
    }

    [Fact]
    public void Rejects_missing_or_empty_parts()
    {
        var area = AreaReference.Personal(Alice);

        Assert.Throws<ArgumentException>(() => Folder.Create(Guid.Empty, area, Name("A"), Created, Alice));
        Assert.Throws<ArgumentNullException>(() => Folder.Create(Id, null!, Name("A"), Created, Alice));
        Assert.Throws<ArgumentNullException>(() => Folder.Create(Id, area, null!, Created, Alice));
        Assert.Throws<ArgumentNullException>(() => Folder.Create(Id, area, Name("A"), Created, Alice).Rename(null!, Created, Alice));
    }
}
