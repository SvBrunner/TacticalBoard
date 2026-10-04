using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Situations.Application;
using TacticalBoard.Situations.Domain;
using TacticalBoard.Situations.Endpoints;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Situations;

public class SituationEndpointsTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");

    private readonly InMemorySituationRepository _repository = new();
    private readonly FakeAreaAccess _areas = new(Alice);
    private readonly SituationService _service;
    private readonly DefaultHttpContext _http = new();

    public SituationEndpointsTests()
    {
        _service = new SituationService(
            _repository,
            _areas,
            new FakeActorDirectory(Alice) { Names = { [Alice] = "Alice" } },
            new SequenceIdGenerator(),
            new FixedClock(new DateTimeOffset(2026, 10, 4, 8, 0, 0, TimeSpan.Zero)));
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private static JsonElement Document(string title = "Powerplay") => SituationDocuments.Element(SituationDocuments.Minimal(title));

    private async Task<SituationResponse> CreateAsync(string title = "Powerplay", string? origin = null)
    {
        var result = await SituationEndpoints.CreatePersonalAsync(new CreateSituationRequest(Document(title), origin), _service, _areas, _http.Response, Cancellation);
        return Assert.IsType<CreatedAtRoute<SituationResponse>>(result.Result).Value!;
    }

    [Fact]
    public async Task Post_creates_a_situation_in_the_personal_area_with_its_location_and_etag()
    {
        var result = await SituationEndpoints.CreatePersonalAsync(new CreateSituationRequest(Document(), null), _service, _areas, _http.Response, Cancellation);

        var created = Assert.IsType<CreatedAtRoute<SituationResponse>>(result.Result);
        Assert.Equal(SituationEndpoints.GetSituationRoute, created.RouteName);
        Assert.Equal(created.Value!.Id, created.RouteValues["id"]);
        Assert.Equal("\"1\"", _http.Response.Headers.ETag.ToString());
        Assert.Equal(("Powerplay", 1, "Alice"), (created.Value.Title, created.Value.Revision, created.Value.CreatedBy.DisplayName));
        Assert.Equal(created.Value.Id.ToString(), created.Value.Document.GetProperty("situation").GetProperty("id").GetString());
        Assert.Equal(AreaReference.Personal(Alice), _repository.Situations[0].Area);
    }

    [Theory]
    [InlineData("imported")]
    [InlineData("copy")]
    public async Task Post_numbers_a_taken_title_for_imports_and_copies(string origin)
    {
        await CreateAsync();

        var second = await CreateAsync(origin: origin);

        Assert.Equal("Powerplay (2)", second.Title);
    }

    [Fact]
    public async Task Post_rejects_an_unknown_origin()
    {
        var result = await SituationEndpoints.CreatePersonalAsync(new CreateSituationRequest(Document(), "stolen"), _service, _areas, _http.Response, Cancellation);

        var problem = Assert.IsType<ValidationProblem>(result.Result);
        Assert.Equal(["expected \"new\", \"imported\" or \"copy\""], problem.ProblemDetails.Errors[SituationEndpoints.OriginField]);
        Assert.Empty(_repository.Situations);
    }

    [Fact]
    public async Task Post_rejects_a_missing_document()
    {
        var result = await SituationEndpoints.CreatePersonalAsync(new CreateSituationRequest(null, null), _service, _areas, _http.Response, Cancellation);

        var problem = Assert.IsType<ValidationProblem>(result.Result);
        Assert.Equal(["The situation document is missing."], problem.ProblemDetails.Errors["document"]);
    }

    [Fact]
    public async Task Post_reports_every_document_issue_by_its_path()
    {
        var file = SituationDocuments.Minimal();
        file["situation"]!["fieldType"] = "quarter";
        file["situation"]!["frames"]![0]!["elements"]![0]!["x"] = "1";

        var result = await SituationEndpoints.CreatePersonalAsync(new CreateSituationRequest(SituationDocuments.Element(file), null), _service, _areas, _http.Response, Cancellation);

        var errors = Assert.IsType<ValidationProblem>(result.Result).ProblemDetails.Errors;
        Assert.Equal(["expected \"full\" or \"half\""], errors["document.situation.fieldType"]);
        Assert.Equal(["expected finite number"], errors["document.situation.frames[0].elements[0].x"]);
    }

    [Fact]
    public async Task Post_reports_a_non_object_document_at_the_document_key()
    {
        var result = await SituationEndpoints.CreatePersonalAsync(new CreateSituationRequest(SituationDocuments.Parse("[]"), null), _service, _areas, _http.Response, Cancellation);

        Assert.Equal(["expected object"], Assert.IsType<ValidationProblem>(result.Result).ProblemDetails.Errors["document"]);
    }

    [Fact]
    public async Task Post_rejects_a_too_long_title()
    {
        var result = await SituationEndpoints.CreatePersonalAsync(
            new CreateSituationRequest(Document(new string('a', SituationTitle.MaxLength + 1)), null), _service, _areas, _http.Response, Cancellation);

        Assert.Equal(["expected at most 200 characters"], Assert.IsType<ValidationProblem>(result.Result).ProblemDetails.Errors["document.situation.title"]);
    }

    [Fact]
    public async Task Get_returns_the_situation_with_its_etag()
    {
        var created = await CreateAsync();
        var http = new DefaultHttpContext();

        var result = await SituationEndpoints.GetAsync(created.Id, _service, http.Response, Cancellation);

        Assert.Equal(created.Id, result.Value!.Id);
        Assert.Equal("\"1\"", http.Response.Headers.ETag.ToString());
        Assert.Equal(JsonValueKind.Object, result.Value.Document.ValueKind);
    }

    [Fact]
    public async Task List_returns_the_personal_area_without_documents()
    {
        await CreateAsync("A");
        await CreateAsync("B");

        var result = await SituationEndpoints.ListPersonalAsync(_service, _areas, Cancellation);

        Assert.Equal(2, result.Value!.Count);
        Assert.All(result.Value, summary => Assert.Equal(new UserReferenceResponse(Alice, "Alice"), summary.CreatedBy));
    }

    [Fact]
    public async Task Put_saves_the_next_revision()
    {
        var created = await CreateAsync();
        var http = new DefaultHttpContext();

        var result = await SituationEndpoints.UpdateAsync(created.Id, new UpdateSituationRequest(Document("Breakout")), "\"1\"", _service, http.Response, Cancellation);

        var ok = Assert.IsType<Ok<SituationResponse>>(result.Result);
        Assert.Equal((2, "Breakout"), (ok.Value!.Revision, ok.Value.Title));
        Assert.Equal("\"2\"", http.Response.Headers.ETag.ToString());
    }

    [Fact]
    public async Task Put_without_if_match_is_428()
    {
        var created = await CreateAsync();

        var result = await SituationEndpoints.UpdateAsync(created.Id, new UpdateSituationRequest(Document()), null, _service, _http.Response, Cancellation);

        Assert.Equal(StatusCodes.Status428PreconditionRequired, Assert.IsType<ProblemHttpResult>(result.Result).StatusCode);
    }

    [Fact]
    public async Task Put_with_a_malformed_if_match_is_400()
    {
        var created = await CreateAsync();

        var result = await SituationEndpoints.UpdateAsync(created.Id, new UpdateSituationRequest(Document()), "*", _service, _http.Response, Cancellation);

        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsType<ProblemHttpResult>(result.Result).StatusCode);
        Assert.Equal(1, _repository.Situations[0].CurrentRevision);
    }

    [Fact]
    public async Task Put_with_an_old_revision_is_a_save_conflict()
    {
        var created = await CreateAsync();
        await SituationEndpoints.UpdateAsync(created.Id, new UpdateSituationRequest(Document()), "\"1\"", _service, _http.Response, Cancellation);

        await Assert.ThrowsAsync<SituationSaveConflictException>(() =>
            SituationEndpoints.UpdateAsync(created.Id, new UpdateSituationRequest(Document()), "\"1\"", _service, _http.Response, Cancellation));
    }

    [Fact]
    public async Task Put_rejects_an_invalid_document()
    {
        var created = await CreateAsync();

        var result = await SituationEndpoints.UpdateAsync(created.Id, new UpdateSituationRequest(null), "\"1\"", _service, _http.Response, Cancellation);

        Assert.IsType<ValidationProblem>(result.Result);
    }

    [Fact]
    public async Task Delete_soft_deletes()
    {
        var created = await CreateAsync();

        var result = await SituationEndpoints.DeleteAsync(created.Id, _service, Cancellation);

        Assert.IsType<NoContent>(result);
        Assert.True(_repository.Situations[0].IsDeleted);
    }

    [Fact]
    public async Task Maps_all_endpoints_behind_authorization()
    {
        await using var app = WebApplication.CreateBuilder().Build();

        SituationEndpoints.Map(app.MapGroup("/api"));

        var endpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>().ToList();
        Assert.Equal(
            [
                "GET /api/personal-area/situations/",
                "POST /api/personal-area/situations/",
                "GET /api/situations/{id:guid}",
                "PUT /api/situations/{id:guid}",
                "DELETE /api/situations/{id:guid}",
            ],
            endpoints.Select(endpoint => endpoint.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods.Single() + " " + endpoint.RoutePattern.RawText));
        Assert.All(endpoints, endpoint => Assert.NotNull(endpoint.Metadata.GetMetadata<IAuthorizeData>()));
    }

    [Fact]
    public void Responses_map_a_deleted_user_without_a_name()
    {
        var view = new SituationView(
            new SituationSummaryView(Guid.NewGuid(), "A", "floorball", "half", null, 3, DateTimeOffset.UnixEpoch, new UserReferenceView(Alice, null), DateTimeOffset.UnixEpoch, new UserReferenceView(Alice, "Alice")),
            new JsonObject { ["x"] = 1 }.ToJsonString());

        var response = SituationResponse.From(view);

        Assert.Null(response.CreatedBy.DisplayName);
        Assert.Equal(("half", 3, 1), (response.FieldType, response.Revision, response.Document.GetProperty("x").GetInt32()));
        Assert.Throws<ArgumentNullException>(() => SituationResponse.From(null!));
        Assert.Throws<ArgumentNullException>(() => SituationSummaryResponse.From(null!));
        Assert.Throws<ArgumentNullException>(() => UserReferenceResponse.From(null!));
    }
}
