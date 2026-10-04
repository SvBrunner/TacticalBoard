using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.UnitTests.SharedKernel;

public class DomainExceptionTests
{
    private sealed class SampleException(DomainErrorKind kind, string code, string title, string detail)
        : DomainException(kind, code, title, detail);

    [Fact]
    public void Carries_kind_code_title_and_detail()
    {
        var exception = new SampleException(DomainErrorKind.Conflict, "duplicate-title", "Duplicate title", "'A' exists.");

        Assert.Equal(DomainErrorKind.Conflict, exception.Kind);
        Assert.Equal("duplicate-title", exception.Code);
        Assert.Equal("Duplicate title", exception.Title);
        Assert.Equal("'A' exists.", exception.Message);
    }

    [Theory]
    [InlineData("Not Kebab")]
    [InlineData("snake_case")]
    public void Rejects_an_invalid_code(string code)
    {
        var thrown = Assert.Throws<ArgumentException>(() => new SampleException(DomainErrorKind.Conflict, code, "Title", "Detail"));
        Assert.Equal("code", thrown.ParamName);
    }

    [Theory]
    [InlineData("", "Title", "Detail")]
    [InlineData("code", " ", "Detail")]
    [InlineData("code", "Title", "")]
    public void Rejects_blank_parts(string code, string title, string detail) =>
        Assert.ThrowsAny<ArgumentException>(() => new SampleException(DomainErrorKind.Validation, code, title, detail));
}
