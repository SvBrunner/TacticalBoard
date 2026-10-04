using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.UnitTests.SharedKernel;

public class ErrorCodeTests
{
    [Theory]
    [InlineData("conflict")]
    [InlineData("duplicate-title")]
    [InlineData("last-admin-2")]
    [InlineData("http-499")]
    public void Accepts_kebab_case_codes(string code) => Assert.True(ErrorCode.IsValid(code));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("Duplicate-title")]
    [InlineData("duplicate_title")]
    [InlineData("duplicate title")]
    [InlineData("-leading")]
    [InlineData("trailing-")]
    [InlineData("double--dash")]
    [InlineData("umlaut-ä")]
    public void Rejects_everything_else(string? code) => Assert.False(ErrorCode.IsValid(code));
}
