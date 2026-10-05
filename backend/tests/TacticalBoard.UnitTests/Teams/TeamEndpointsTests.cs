using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using SkiaSharp;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.Teams.Endpoints;
using TacticalBoard.Teams.Infrastructure;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamEndpointsTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");

    private readonly InMemoryTeamRepository _repository = new();
    private readonly FakeCurrentUser _currentUser = new(Alice);
    private readonly SkiaLogoImageProcessor _processor = new();
    private readonly TeamService _service;

    public TeamEndpointsTests()
    {
        _service = new TeamService(
            _repository,
            new TeamAuthorization(_currentUser, _repository),
            _currentUser,
            new SequenceTeamCodeGenerator("AAAAAA", "BBBBBB", "CCCCCC"),
            new FakeUnitOfWork(),
            new SequenceIdGenerator(),
            new FixedClock(TestTeams.Now));
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private static FormFile File(byte[] content, string fileName = "logo.png") =>
        new(new MemoryStream(content), 0, content.Length, TeamEndpoints.LogoField, fileName);

    private static byte[] Png(int width = 512, int height = 256) => TestImages.Halves(width, height, SKEncodedImageFormat.Png);

    private async Task<TeamResponse> CreateAsync(string name = "Lions", IFormFile? logo = null)
    {
        var result = await TeamEndpoints.CreateAsync(name, logo, _service, _processor, Cancellation);
        return Assert.IsType<CreatedAtRoute<TeamResponse>>(result.Result).Value!;
    }

    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, object>[]> Codes(ValidationProblem problem) =>
        Assert.IsAssignableFrom<IReadOnlyDictionary<string, IReadOnlyDictionary<string, object>[]>>(problem.ProblemDetails.Extensions["fieldErrors"]);

    [Fact]
    public async Task Post_creates_a_team_with_its_location_and_the_creator_as_Admin()
    {
        var result = await TeamEndpoints.CreateAsync(" Lions ", null, _service, _processor, Cancellation);

        var created = Assert.IsType<CreatedAtRoute<TeamResponse>>(result.Result);
        Assert.Equal(TeamEndpoints.GetTeamRoute, created.RouteName);
        Assert.Equal("AAAAAA", created.RouteValues["code"]);
        Assert.Equal(("AAAAAA", "Lions", null, "admin"), (created.Value!.Code, created.Value.Name, created.Value.LogoUrl, created.Value.Role));
    }

    [Fact]
    public async Task Post_with_a_logo_stores_it_scaled_down_and_links_it()
    {
        var team = await CreateAsync("Lions", File(Png()));

        var hash = _repository.Teams[0].LogoHash;
        Assert.Equal($"/api/teams/AAAAAA/logo?v={hash}", team.LogoUrl);
        var stored = TestImages.Decode(_repository.Logos[team.Id].Content);
        Assert.Equal((256, 128), (stored.Width, stored.Height));
    }

    [Fact]
    public async Task Post_reports_an_invalid_name_and_an_invalid_logo_together()
    {
        var result = await TeamEndpoints.CreateAsync("  ", File(Encoding.UTF8.GetBytes("<svg/>"), "logo.svg"), _service, _processor, Cancellation);

        var problem = Assert.IsType<ValidationProblem>(result.Result);
        var codes = Codes(problem);
        Assert.Equal("required", codes[TeamEndpoints.NameField].Single()["code"]);
        Assert.Equal("unsupported-image", codes[TeamEndpoints.LogoField].Single()["code"]);
        Assert.Equal(["must not be empty"], problem.ProblemDetails.Errors[TeamEndpoints.NameField]);
        Assert.Empty(_repository.Teams);
    }

    [Fact]
    public async Task Post_rejects_a_logo_larger_than_5_MiB_without_reading_it()
    {
        var large = new FormFile(Stream.Null, 0, LogoUpload.MaxBytes + 1, TeamEndpoints.LogoField, "huge.png");

        var result = await TeamEndpoints.CreateAsync("Lions", large, _service, _processor, Cancellation);

        var code = Codes(Assert.IsType<ValidationProblem>(result.Result))[TeamEndpoints.LogoField].Single();
        Assert.Equal(("file-too-large", 5 * 1024 * 1024), (code["code"], code["maxBytes"]));
        Assert.Empty(_repository.Teams);
    }

    [Fact]
    public async Task Get_returns_the_team_with_the_current_users_role()
    {
        var created = await CreateAsync();

        var asAdmin = await TeamEndpoints.GetAsync("aaaaaa", _service, Cancellation);
        _currentUser.UserId = Bob;
        var asStranger = await TeamEndpoints.GetAsync("AAAAAA", _service, Cancellation);

        Assert.Equal(created, asAdmin.Value);
        Assert.Equal(created with { Role = null }, asStranger.Value);
    }

    [Theory]
    [InlineData("ZZZZZZ")]
    [InlineData("not-a-code")]
    public async Task An_unknown_or_malformed_code_is_not_found(string code)
    {
        await Assert.ThrowsAsync<TeamNotFoundException>(() => TeamEndpoints.GetAsync(code, _service, Cancellation));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => TeamEndpoints.RemoveLogoAsync(code, _service, Cancellation));
    }

    [Fact]
    public async Task Search_returns_a_page_and_the_total()
    {
        await CreateAsync("Lions");
        await CreateAsync("Tigers");
        await CreateAsync("Lionesses");

        var result = await TeamEndpoints.SearchAsync("LION", 0, 1, _service, Cancellation);

        var page = Assert.IsType<Ok<TeamSearchResponse>>(result.Result).Value!;
        Assert.Equal((2, 0, 1), (page.Total, page.Offset, page.Limit));
        Assert.Equal(["Lionesses"], page.Items.Select(team => team.Name));
    }

    [Fact]
    public async Task Search_reports_a_bad_page()
    {
        var result = await TeamEndpoints.SearchAsync(null, -1, 500, _service, Cancellation);

        var codes = Codes(Assert.IsType<ValidationProblem>(result.Result));
        Assert.Equal(["offset", "limit"], codes.Keys);
    }

    [Fact]
    public async Task Lists_my_teams_with_roles()
    {
        await CreateAsync("Lions");
        _repository.AddMember(_repository.Teams[0], Bob, TeamRole.Editor);
        _currentUser.UserId = Bob;

        var mine = await TeamEndpoints.ListMineAsync(_service, Cancellation);

        var team = Assert.Single(mine.Value!);
        Assert.Equal(("Lions", "AAAAAA", "editor", null), (team.Name, team.Code, team.Role, team.LogoUrl));
    }

    [Fact]
    public async Task Put_renames_or_reports_an_invalid_name()
    {
        await CreateAsync();

        var renamed = await TeamEndpoints.RenameAsync("AAAAAA", new TeamNameRequest("Tigers"), _service, Cancellation);
        var invalid = await TeamEndpoints.RenameAsync("AAAAAA", new TeamNameRequest(new string('x', 65)), _service, Cancellation);

        Assert.Equal("Tigers", Assert.IsType<Ok<TeamResponse>>(renamed.Result).Value!.Name);
        var code = Codes(Assert.IsType<ValidationProblem>(invalid.Result))[TeamEndpoints.NameField].Single();
        Assert.Equal(("too-long", 64), (code["code"], code["maxLength"]));
    }

    [Fact]
    public async Task Put_logo_replaces_it_and_delete_removes_it()
    {
        var created = await CreateAsync();

        var set = await TeamEndpoints.SetLogoAsync("AAAAAA", File(Png(64, 64)), _service, _processor, Cancellation);
        var withLogo = Assert.IsType<Ok<TeamResponse>>(set.Result).Value!;
        Assert.StartsWith("/api/teams/AAAAAA/logo?v=", withLogo.LogoUrl, StringComparison.Ordinal);

        var removed = await TeamEndpoints.RemoveLogoAsync("AAAAAA", _service, Cancellation);
        Assert.IsType<NoContent>(removed);
        Assert.False(_repository.Logos.ContainsKey(created.Id));
    }

    [Fact]
    public async Task Put_logo_needs_a_readable_image()
    {
        await CreateAsync();

        var missing = await TeamEndpoints.SetLogoAsync("AAAAAA", null, _service, _processor, Cancellation);
        var unreadable = await TeamEndpoints.SetLogoAsync("AAAAAA", File([1, 2, 3]), _service, _processor, Cancellation);

        Assert.Equal("required", Codes(Assert.IsType<ValidationProblem>(missing.Result))[TeamEndpoints.LogoField].Single()["code"]);
        Assert.Equal("unsupported-image", Codes(Assert.IsType<ValidationProblem>(unreadable.Result))[TeamEndpoints.LogoField].Single()["code"]);
        Assert.Empty(_repository.Logos);
    }

    [Fact]
    public async Task Get_logo_sends_the_png_with_its_etag_and_revalidation_caching()
    {
        await CreateAsync("Lions", File(Png(64, 64)));
        var context = new DefaultHttpContext();

        var result = await TeamEndpoints.GetLogoAsync("AAAAAA", context, _service, Cancellation);

        var file = Assert.IsType<FileContentHttpResult>(result.Result);
        Assert.Equal("image/png", file.ContentType);
        Assert.True(TestImages.IsPng(file.FileContents.ToArray()));
        Assert.Equal($"\"{_repository.Teams[0].LogoHash}\"", context.Response.Headers.ETag.ToString());
        Assert.Equal("private, no-cache", context.Response.Headers.CacheControl.ToString());
        Assert.Equal("nosniff", context.Response.Headers.XContentTypeOptions.ToString());
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(true, true)]
    [InlineData(false, false)]
    public async Task Get_logo_answers_304_when_the_browser_has_it(bool matching, bool weak)
    {
        await CreateAsync("Lions", File(Png(64, 64)));
        var hash = matching ? _repository.Teams[0].LogoHash : "0000";
        var context = new DefaultHttpContext();
        context.Request.Headers.IfNoneMatch = (weak ? "W/" : string.Empty) + $"\"{hash}\"";

        var result = await TeamEndpoints.GetLogoAsync("AAAAAA", context, _service, Cancellation);

        if (matching)
        {
            Assert.Equal(StatusCodes.Status304NotModified, Assert.IsType<StatusCodeHttpResult>(result.Result).StatusCode);
        }
        else
        {
            Assert.IsType<FileContentHttpResult>(result.Result);
        }
    }

    [Fact]
    public async Task Get_logo_without_a_logo_is_not_found()
    {
        await CreateAsync();

        await Assert.ThrowsAsync<TeamLogoNotFoundException>(() => TeamEndpoints.GetLogoAsync("AAAAAA", new DefaultHttpContext(), _service, Cancellation));
    }

    [Fact]
    public void Roles_are_named_in_lower_case()
    {
        Assert.Equal(["admin", "editor", "reader"], Enum.GetValues<TeamRole>().Select(TeamJson.Role));
        Assert.Throws<ArgumentOutOfRangeException>(() => TeamJson.Role((TeamRole)42));
    }

    [Fact]
    public void The_upload_limit_leaves_room_for_the_form_around_the_file()
    {
        Assert.Equal(LogoUpload.MaxBytes + (64 * 1024), TeamEndpoints.MaxUploadRequestBytes);
        Assert.Equal(["image/png", "image/jpeg", "image/webp"], LogoUpload.AcceptedContentTypes);
    }
}
