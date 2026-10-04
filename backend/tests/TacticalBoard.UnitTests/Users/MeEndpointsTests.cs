using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using TacticalBoard.Users.Application;
using TacticalBoard.Users.Endpoints;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Users;

public class MeEndpointsTests
{
    private readonly InMemoryUserRepository _repository = new();
    private readonly CurrentUserState _currentUser = new();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private Guid SignedIn(string name = "Alice", bool admin = false)
    {
        var user = TestUsers.Create("alice", name);
        if (admin)
        {
            user.GrantSystemAdministrator();
        }

        _repository.Users.Add(user);
        _currentUser.Set(new SessionUser(user.Id, name, admin, IsBlocked: false));
        return user.Id;
    }

    [Fact]
    public void Get_returns_the_current_user()
    {
        var id = SignedIn("Alice", admin: true);

        var result = MeEndpoints.GetMe(_currentUser);

        Assert.Equal(new MeResponse(id, "Alice", IsSystemAdministrator: true, PreferredLanguage: null), result.Value);
    }

    [Fact]
    public async Task Put_changes_the_display_name_and_returns_the_user()
    {
        var id = SignedIn();

        var result = await MeEndpoints.ChangeDisplayNameAsync(
            new ChangeDisplayNameRequest("  Coach  "), new UserProfileService(_repository, _currentUser), Cancellation);

        var ok = Assert.IsType<Ok<MeResponse>>(result.Result);
        Assert.Equal(new MeResponse(id, "Coach", IsSystemAdministrator: false, PreferredLanguage: null), ok.Value);
        Assert.Equal("Coach", _repository.Users[0].DisplayName.Value);
    }

    [Theory]
    [InlineData(null, "The display name must not be empty.", "required")]
    [InlineData("   ", "The display name must not be empty.", "required")]
    [InlineData("12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901", "The display name must be at most 100 characters long.", "too-long")]
    public async Task Put_rejects_an_invalid_name_as_a_validation_problem(string? input, string message, string code)
    {
        SignedIn();

        var result = await MeEndpoints.ChangeDisplayNameAsync(
            new ChangeDisplayNameRequest(input), new UserProfileService(_repository, _currentUser), Cancellation);

        var problem = Assert.IsType<ValidationProblem>(result.Result);
        Assert.Equal([message], problem.ProblemDetails.Errors[MeEndpoints.DisplayNameField]);
        var codes = Assert.IsAssignableFrom<IReadOnlyDictionary<string, IReadOnlyDictionary<string, object>[]>>(problem.ProblemDetails.Extensions["fieldErrors"]);
        Assert.Equal(code, codes[MeEndpoints.DisplayNameField].Single()["code"]);
        Assert.Equal("Alice", _repository.Users[0].DisplayName.Value);
        Assert.Equal(0, _repository.SaveCount);
    }

    [Theory]
    [InlineData("de", "de")]
    [InlineData(" de-CH ", "de-ch")]
    [InlineData("EN", "en")]
    public async Task Put_language_stores_the_tag_and_returns_the_user(string input, string stored)
    {
        var id = SignedIn();

        var result = await MeEndpoints.ChangeLanguageAsync(
            new ChangeLanguageRequest(input), new UserProfileService(_repository, _currentUser), Cancellation);

        var ok = Assert.IsType<Ok<MeResponse>>(result.Result);
        Assert.Equal(new MeResponse(id, "Alice", IsSystemAdministrator: false, PreferredLanguage: stored), ok.Value);
        Assert.Equal(stored, _repository.Users[0].PreferredLanguage?.Value);
        Assert.Equal(stored, _currentUser.User.PreferredLanguage);
        Assert.Equal(1, _repository.SaveCount);
    }

    [Theory]
    [InlineData(null, "required")]
    [InlineData("  ", "required")]
    [InlineData("deutsch", "unsupported-language")]
    [InlineData("d", "unsupported-language")]
    [InlineData("de_CH", "unsupported-language")]
    public async Task Put_language_rejects_an_invalid_tag_with_a_code(string? input, string code)
    {
        SignedIn();

        var result = await MeEndpoints.ChangeLanguageAsync(
            new ChangeLanguageRequest(input), new UserProfileService(_repository, _currentUser), Cancellation);

        var problem = Assert.IsType<ValidationProblem>(result.Result);
        Assert.Single(problem.ProblemDetails.Errors[MeEndpoints.LanguageField]);
        var codes = Assert.IsAssignableFrom<IReadOnlyDictionary<string, IReadOnlyDictionary<string, object>[]>>(problem.ProblemDetails.Extensions["fieldErrors"]);
        Assert.Equal(code, codes[MeEndpoints.LanguageField].Single()["code"]);
        Assert.Null(_repository.Users[0].PreferredLanguage);
        Assert.Equal(0, _repository.SaveCount);
    }

    [Fact]
    public async Task Maps_the_endpoints_behind_authorization()
    {
        await using var app = WebApplication.CreateBuilder().Build();

        MeEndpoints.Map(app.MapGroup("/api"));

        var endpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>().ToList();
        Assert.Equal(["/api/me/", "/api/me/display-name", "/api/me/language"], endpoints.Select(endpoint => endpoint.RoutePattern.RawText));
        Assert.All(endpoints, endpoint => Assert.NotNull(endpoint.Metadata.GetMetadata<IAuthorizeData>()));
        Assert.Equal(["GET", "PUT", "PUT"], endpoints.Select(endpoint => endpoint.Metadata.GetMetadata<Microsoft.AspNetCore.Routing.HttpMethodMetadata>()!.HttpMethods.Single()));
    }
}
