using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Application;
using TacticalBoard.Folders.Contracts;
using TacticalBoard.Folders.Domain;
using TacticalBoard.Folders.Endpoints;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Folders;

public class FolderEndpointsTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");

    private readonly InMemoryFolderRepository _repository = new();
    private readonly FakeFolderContents _contents = new();
    private readonly FakeAreaAccess _areas = new(Alice);
    private readonly FolderService _service;

    public FolderEndpointsTests()
    {
        _service = new FolderService(
            _repository,
            _contents,
            _areas,
            new FakeActorDirectory(Alice),
            new FakeUnitOfWork(),
            new SequenceIdGenerator(),
            new FixedClock(new DateTimeOffset(2026, 10, 4, 8, 0, 0, TimeSpan.Zero)));
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private async Task<FolderResponse> CreateAsync(string? name = "Set pieces")
    {
        var result = await FolderEndpoints.CreatePersonalAsync(new FolderNameRequest(name), _service, _areas, Cancellation);
        return Assert.IsType<CreatedAtRoute<FolderResponse>>(result.Result).Value!;
    }

    [Fact]
    public async Task Post_creates_a_folder_in_the_personal_area_with_its_location()
    {
        var result = await FolderEndpoints.CreatePersonalAsync(new FolderNameRequest(" Set pieces "), _service, _areas, Cancellation);

        var created = Assert.IsType<CreatedAtRoute<FolderResponse>>(result.Result);
        Assert.Equal(FolderEndpoints.GetFolderRoute, created.RouteName);
        Assert.Equal(created.Value!.Id, created.RouteValues["id"]);
        Assert.Equal("Set pieces", created.Value.Name);
        Assert.Equal(AreaReference.Personal(Alice), _repository.Folders[0].Area);
    }

    [Theory]
    [InlineData(null, "must not be empty", "required")]
    [InlineData("  ", "must not be empty", "required")]
    [InlineData("a\nb", "must not contain control characters", "control-characters")]
    public async Task Post_and_put_report_an_invalid_name(string? name, string message, string code)
    {
        var post = await FolderEndpoints.CreatePersonalAsync(new FolderNameRequest(name), _service, _areas, Cancellation);
        var created = await CreateAsync();
        var put = await FolderEndpoints.RenameAsync(created.Id, new FolderNameRequest(name), _service, Cancellation);

        Assert.Equal([message], Assert.IsType<ValidationProblem>(post.Result).ProblemDetails.Errors[FolderEndpoints.NameField]);
        Assert.Equal([message], Assert.IsType<ValidationProblem>(put.Result).ProblemDetails.Errors[FolderEndpoints.NameField]);
        foreach (var problem in new[] { Assert.IsType<ValidationProblem>(post.Result), Assert.IsType<ValidationProblem>(put.Result) })
        {
            var codes = Assert.IsAssignableFrom<IReadOnlyDictionary<string, IReadOnlyDictionary<string, object>[]>>(problem.ProblemDetails.Extensions["fieldErrors"]);
            Assert.Equal(code, codes[FolderEndpoints.NameField].Single()["code"]);
        }
        Assert.Equal("Set pieces", Assert.Single(_repository.Folders).Name);
    }

    [Fact]
    public async Task Get_and_list_return_folders()
    {
        var created = await CreateAsync("B");
        await CreateAsync("a");

        var get = await FolderEndpoints.GetAsync(created.Id, _service, Cancellation);
        var list = await FolderEndpoints.ListPersonalAsync(_service, _areas, Cancellation);

        Assert.Equal(created, get.Value);
        Assert.Equal(["a", "B"], list.Value!.Select(folder => folder.Name));
    }

    [Fact]
    public async Task Put_renames()
    {
        var created = await CreateAsync();

        var result = await FolderEndpoints.RenameAsync(created.Id, new FolderNameRequest("Breakouts"), _service, Cancellation);

        Assert.Equal("Breakouts", Assert.IsType<Ok<FolderResponse>>(result.Result).Value!.Name);
    }

    [Fact]
    public async Task Delete_soft_deletes_an_empty_folder_and_refuses_a_full_one()
    {
        var empty = await CreateAsync("Empty");
        var full = await CreateAsync("Full");
        _contents.NonEmpty.Add(full.Id);

        Assert.IsType<NoContent>(await FolderEndpoints.DeleteAsync(empty.Id, _service, Cancellation));
        await Assert.ThrowsAsync<FolderNotEmptyException>(() => FolderEndpoints.DeleteAsync(full.Id, _service, Cancellation));
        await Assert.ThrowsAsync<FolderNotFoundException>(() => FolderEndpoints.GetAsync(empty.Id, _service, Cancellation));
    }

    [Fact]
    public async Task Rejects_missing_arguments()
    {
        await Assert.ThrowsAsync<ArgumentNullException>(() => FolderEndpoints.ListPersonalAsync(null!, _areas, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => FolderEndpoints.ListPersonalAsync(_service, null!, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => FolderEndpoints.CreatePersonalAsync(null!, _service, _areas, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => FolderEndpoints.GetAsync(Guid.NewGuid(), null!, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => FolderEndpoints.RenameAsync(Guid.NewGuid(), null!, _service, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => FolderEndpoints.DeleteAsync(Guid.NewGuid(), null!, Cancellation));
        Assert.Throws<ArgumentNullException>(() => FolderResponse.From(null!));
    }

    [Fact]
    public async Task Maps_all_endpoints_behind_authorization()
    {
        await using var app = WebApplication.CreateBuilder().Build();

        FolderEndpoints.Map(app.MapGroup("/api"));

        var endpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>().ToList();
        Assert.Equal(
            [
                "GET /api/personal-area/folders/",
                "POST /api/personal-area/folders/",
                "GET /api/folders/{id:guid}",
                "PUT /api/folders/{id:guid}",
                "DELETE /api/folders/{id:guid}",
            ],
            endpoints.Select(endpoint => endpoint.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods.Single() + " " + endpoint.RoutePattern.RawText));
        Assert.All(endpoints, endpoint => Assert.NotNull(endpoint.Metadata.GetMetadata<IAuthorizeData>()));
    }
}
