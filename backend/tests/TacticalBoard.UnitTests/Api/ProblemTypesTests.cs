using TacticalBoard.Api.ErrorHandling;

namespace TacticalBoard.UnitTests.Api;

public class ProblemTypesTests
{
    [Fact]
    public void Builds_the_type_uri_from_a_code() =>
        Assert.Equal("https://tacticalboard/errors/duplicate-title", ProblemTypes.ForCode("duplicate-title"));

    [Theory]
    [InlineData("Duplicate Title")]
    [InlineData("")]
    public void Rejects_an_invalid_code(string code) =>
        Assert.Throws<ArgumentException>(() => ProblemTypes.ForCode(code));

    [Theory]
    [InlineData(400, "bad-request")]
    [InlineData(401, "unauthorized")]
    [InlineData(403, "forbidden")]
    [InlineData(404, "not-found")]
    [InlineData(405, "method-not-allowed")]
    [InlineData(409, "conflict")]
    [InlineData(412, "precondition-failed")]
    [InlineData(415, "unsupported-media-type")]
    [InlineData(418, "im-a-teapot")]
    [InlineData(500, "internal-error")]
    [InlineData(503, "service-unavailable")]
    [InlineData(599, "http-599")]
    public void Derives_codes_for_http_status_codes(int statusCode, string code)
    {
        Assert.Equal(code, ProblemTypes.CodeForStatusCode(statusCode));
        Assert.Equal(ProblemTypes.BaseUri + code, ProblemTypes.ForStatusCode(statusCode));
    }

    [Theory]
    [InlineData("https://tacticalboard/errors/not-found", true)]
    [InlineData("https://tools.ietf.org/html/rfc9110#section-15.5.5", false)]
    [InlineData("about:blank", false)]
    [InlineData(null, false)]
    public void Recognizes_its_own_type_uris(string? type, bool own) => Assert.Equal(own, ProblemTypes.IsOwn(type));
}
