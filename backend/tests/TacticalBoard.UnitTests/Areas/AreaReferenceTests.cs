using TacticalBoard.Areas.Contracts;

namespace TacticalBoard.UnitTests.Areas;

public class AreaReferenceTests
{
    [Fact]
    public void A_personal_area_belongs_to_its_user()
    {
        var userId = Guid.NewGuid();

        var area = AreaReference.Personal(userId);

        Assert.Equal(AreaKind.Personal, area.Kind);
        Assert.Equal(userId, area.OwnerId);
    }

    [Fact]
    public void Compares_by_kind_and_owner()
    {
        var id = Guid.NewGuid();

        Assert.Equal(AreaReference.Personal(id), new AreaReference(AreaKind.Personal, id));
        Assert.NotEqual(AreaReference.Personal(id), new AreaReference(AreaKind.Team, id));
        Assert.NotEqual(AreaReference.Personal(id), AreaReference.Personal(Guid.NewGuid()));
    }

    [Fact]
    public void Rejects_an_empty_owner() =>
        Assert.Throws<ArgumentException>(() => AreaReference.Personal(Guid.Empty));

    [Fact]
    public void Rejects_an_unknown_kind() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => new AreaReference((AreaKind)42, Guid.NewGuid()));
}
