using TacticalBoard.Api.ErrorHandling;
using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.UnitTests.Api;

public class DomainErrorStatusCodesTests
{
    [Theory]
    [InlineData(DomainErrorKind.Validation, 400)]
    [InlineData(DomainErrorKind.Forbidden, 403)]
    [InlineData(DomainErrorKind.NotFound, 404)]
    [InlineData(DomainErrorKind.Conflict, 409)]
    [InlineData(DomainErrorKind.PreconditionFailed, 412)]
    public void Maps_each_kind_to_a_status_code(DomainErrorKind kind, int statusCode) =>
        Assert.Equal(statusCode, DomainErrorStatusCodes.For(kind));

    [Fact]
    public void Covers_every_kind()
    {
        foreach (var kind in Enum.GetValues<DomainErrorKind>())
        {
            Assert.InRange(DomainErrorStatusCodes.For(kind), 400, 499);
        }
    }

    [Fact]
    public void Rejects_an_unknown_kind() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => DomainErrorStatusCodes.For((DomainErrorKind)999));
}
