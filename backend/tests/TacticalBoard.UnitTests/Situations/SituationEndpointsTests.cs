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
    private readonly FakeFolderDirectory _folders = new();
    private readonly FakeAreaDirectory _directory = new();
    private readonly SituationService _service;
    private readonly DefaultHttpContext _http = new();

    public SituationEndpointsTests()
    {
        _service = new SituationService(
            _repository,
            _folders,
            _areas,
            new FakeActorDirectory(Alice) { Names = { [Alice] = "Alice" } },
            new FakeUnitOfWork(),
            new SequenceIdGenerator(),
            new FixedClock(new DateTimeOffset(2026, 10, 4, 8, 0, 0, TimeSpan.Zero)));
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private static IReadOnlyDictionary<string, object>[] CodesOf(ValidationProblem problem, string field) =>
        Assert.IsAssignableFrom<IReadOnlyDictionary<string, IReadOnlyDictionary<string, object>[]>>(problem.ProblemDetails.Extensions["fieldErrors"])[field];

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
    public async Task Post_numbers_a_default_title_of_the_clients_language_when_it_says_so()
    {
        await CreateAsync("Unbenannte Situation");

        var result = await SituationEndpoints.CreatePersonalAsync(
            new CreateSituationRequest(Document("Unbenannte Situation"), "new", TitleIsDefault: true), _service, _areas, _http.Response, Cancellation);

        Assert.Equal("Unbenannte Situation (2)", Assert.IsType<CreatedAtRoute<SituationResponse>>(result.Result).Value!.Title);
    }

    [Fact]
    public async Task Post_rejects_a_taken_title_of_a_new_situation_without_the_default_flag()
    {
        await CreateAsync("Unbenannte Situation");

        await Assert.ThrowsAsync<DuplicateSituationTitleException>(() => CreateAsync("Unbenannte Situation", "new"));
    }

    [Fact]
    public async Task Post_rejects_an_unknown_origin()
    {
        var result = await SituationEndpoints.CreatePersonalAsync(new CreateSituationRequest(Document(), "stolen"), _service, _areas, _http.Response, Cancellation);

        var problem = Assert.IsType<ValidationProblem>(result.Result);
        Assert.Equal(["expected \"new\", \"imported\" or \"copy\""], problem.ProblemDetails.Errors[SituationEndpoints.OriginField]);
        Assert.Equal("invalid-value", CodesOf(problem, SituationEndpoints.OriginField).Single()["code"]);
        Assert.Empty(_repository.Situations);
    }

    [Fact]
    public async Task Post_rejects_a_missing_document()
    {
        var result = await SituationEndpoints.CreatePersonalAsync(new CreateSituationRequest(null, null), _service, _areas, _http.Response, Cancellation);

        var problem = Assert.IsType<ValidationProblem>(result.Result);
        Assert.Equal(["The situation document is missing."], problem.ProblemDetails.Errors["document"]);
        Assert.Equal("required", CodesOf(problem, "document").Single()["code"]);
    }

    [Fact]
    public async Task Post_reports_every_document_issue_by_its_path()
    {
        var file = SituationDocuments.Minimal();
        file["situation"]!["fieldType"] = "quarter";
        file["situation"]!["frames"]![0]!["elements"]![0]!["x"] = "1";

        var result = await SituationEndpoints.CreatePersonalAsync(new CreateSituationRequest(SituationDocuments.Element(file), null), _service, _areas, _http.Response, Cancellation);

        var problem = Assert.IsType<ValidationProblem>(result.Result);
        var errors = problem.ProblemDetails.Errors;
        Assert.Equal(["expected \"full\" or \"half\""], errors["document.situation.fieldType"]);
        Assert.Equal(["expected finite number"], errors["document.situation.frames[0].elements[0].x"]);
        Assert.Equal("expected-field-type", CodesOf(problem, "document.situation.fieldType").Single()["code"]);
        Assert.Equal("expected-finite-number", CodesOf(problem, "document.situation.frames[0].elements[0].x").Single()["code"]);
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

        var problem = Assert.IsType<ValidationProblem>(result.Result);
        Assert.Equal(["expected at most 200 characters"], problem.ProblemDetails.Errors["document.situation.title"]);
        var code = CodesOf(problem, "document.situation.title").Single();
        Assert.Equal(("too-long", 200), (code["code"], code["maxLength"]));
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
                "GET /api/teams/{team}/situations/",
                "POST /api/teams/{team}/situations/",
                "GET /api/folders/{folderId:guid}/situations/",
                "POST /api/folders/{folderId:guid}/situations/",
                "GET /api/situations/{id:guid}",
                "PUT /api/situations/{id:guid}",
                "PUT /api/situations/{id:guid}/folder",
                "DELETE /api/situations/{id:guid}",
            ],
            endpoints.Select(endpoint => endpoint.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods.Single() + " " + endpoint.RoutePattern.RawText));
        Assert.All(endpoints, endpoint => Assert.NotNull(endpoint.Metadata.GetMetadata<IAuthorizeData>()));
    }

    [Fact]
    public void Responses_map_a_deleted_user_without_a_name()
    {
        var view = new SituationView(
            new SituationSummaryView(Guid.NewGuid(), "A", "floorball", "half", null, 3, DateTimeOffset.UnixEpoch, new UserReferenceView(Alice, null), DateTimeOffset.UnixEpoch, new UserReferenceView(Alice, "Alice"), new AreaReference(AreaKind.Team, Alice), false),
            new JsonObject { ["x"] = 1 }.ToJsonString());

        var response = SituationResponse.From(view);

        Assert.Null(response.CreatedBy.DisplayName);
        Assert.Equal(("half", 3, 1), (response.FieldType, response.Revision, response.Document.GetProperty("x").GetInt32()));
        Assert.Equal((new AreaResponse("team", Alice), false), (response.Area, response.CanWrite));
        Assert.Throws<ArgumentNullException>(() => SituationResponse.From(null!));
        Assert.Throws<ArgumentNullException>(() => SituationSummaryResponse.From(null!));
        Assert.Throws<ArgumentNullException>(() => UserReferenceResponse.From(null!));
    }

    [Fact]
    public async Task Team_endpoints_create_and_list_at_the_top_level_of_the_teams_area()
    {
        var team = _directory.AddTeam("ABC123");
        _areas.Readable.Add(team);
        _areas.Writable.Add(team);

        var result = await SituationEndpoints.CreateTeamAsync("abc123", new CreateSituationRequest(Document(), null), _service, _directory, _http.Response, Cancellation);
        var created = Assert.IsType<CreatedAtRoute<SituationResponse>>(result.Result).Value!;
        var list = await SituationEndpoints.ListTeamAsync(team.OwnerId.ToString(), _service, _directory, Cancellation);
        var personal = await SituationEndpoints.ListPersonalAsync(_service, _areas, Cancellation);

        Assert.Equal((new AreaResponse("team", team.OwnerId), true, (Guid?)null), (created.Area, created.CanWrite, created.FolderId));
        Assert.Equal("\"1\"", _http.Response.Headers.ETag.ToString());
        Assert.Equal([created.Id], list.Value!.Select(situation => situation.Id));
        Assert.Empty(personal.Value!);
    }

    [Fact]
    public async Task Team_endpoints_give_readers_canWrite_false_and_refuse_their_saves()
    {
        var team = _directory.AddTeam("ABC123");
        _areas.Readable.Add(team);
        _areas.Writable.Add(team);
        var created = Assert.IsType<CreatedAtRoute<SituationResponse>>((await SituationEndpoints.CreateTeamAsync("ABC123", new CreateSituationRequest(Document(), null), _service, _directory, _http.Response, Cancellation)).Result).Value!;
        _areas.Writable.Remove(team);

        var list = await SituationEndpoints.ListTeamAsync("ABC123", _service, _directory, Cancellation);
        var get = await SituationEndpoints.GetAsync(created.Id, _service, _http.Response, Cancellation);

        Assert.False(Assert.Single(list.Value!).CanWrite);
        Assert.False(get.Value!.CanWrite);
        await Assert.ThrowsAsync<SituationAccessDeniedException>(() => SituationEndpoints.CreateTeamAsync("ABC123", new CreateSituationRequest(Document("Other"), null), _service, _directory, _http.Response, Cancellation));
    }

    [Fact]
    public async Task Team_endpoints_report_an_unknown_team_and_reject_missing_arguments()
    {
        _directory.AddTeam("ABC123");
        var request = new CreateSituationRequest(Document(), null);

        await Assert.ThrowsAsync<TeamAreaNotFoundException>(() => SituationEndpoints.ListTeamAsync("nope", _service, _directory, Cancellation));
        await Assert.ThrowsAsync<TeamAreaNotFoundException>(() => SituationEndpoints.CreateTeamAsync("ZZZ999", request, _service, _directory, _http.Response, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => SituationEndpoints.ListTeamAsync("ABC123", null!, _directory, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => SituationEndpoints.ListTeamAsync("ABC123", _service, null!, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => SituationEndpoints.CreateTeamAsync("ABC123", null!, _service, _directory, _http.Response, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => SituationEndpoints.CreateTeamAsync("ABC123", request, null!, _directory, _http.Response, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => SituationEndpoints.CreateTeamAsync("ABC123", request, _service, null!, _http.Response, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => SituationEndpoints.CreateTeamAsync("ABC123", request, _service, _directory, null!, Cancellation));
    }

    [Fact]
    public async Task Post_in_a_folder_creates_the_situation_there_with_its_location_and_etag()
    {
        var folder = _folders.Add(AreaReference.Personal(Alice));

        var result = await SituationEndpoints.CreateInFolderAsync(folder.Id, new CreateSituationRequest(Document(), "imported"), _service, _http.Response, Cancellation);

        var created = Assert.IsType<CreatedAtRoute<SituationResponse>>(result.Result);
        Assert.Equal(SituationEndpoints.GetSituationRoute, created.RouteName);
        Assert.Equal(folder.Id, created.Value!.FolderId);
        Assert.Equal("\"1\"", _http.Response.Headers.ETag.ToString());
    }

    [Fact]
    public async Task Post_in_a_folder_validates_like_the_personal_area()
    {
        var folder = _folders.Add(AreaReference.Personal(Alice));

        var result = await SituationEndpoints.CreateInFolderAsync(folder.Id, new CreateSituationRequest(null, "elsewhere"), _service, _http.Response, Cancellation);

        var errors = Assert.IsType<ValidationProblem>(result.Result).ProblemDetails.Errors;
        Assert.True(errors.ContainsKey(SituationEndpoints.OriginField));
        Assert.True(errors.ContainsKey(SituationEndpoints.DocumentField));
        Assert.Empty(_repository.Situations);
    }

    [Fact]
    public async Task List_of_a_folder_returns_its_situations_and_the_personal_list_only_the_top_level()
    {
        var folder = _folders.Add(AreaReference.Personal(Alice));
        await CreateAsync("Top");
        await SituationEndpoints.CreateInFolderAsync(folder.Id, new CreateSituationRequest(Document("Inside"), null), _service, _http.Response, Cancellation);

        var inFolder = await SituationEndpoints.ListInFolderAsync(folder.Id, _service, Cancellation);
        var top = await SituationEndpoints.ListPersonalAsync(_service, _areas, Cancellation);

        Assert.Equal(["Inside"], inFolder.Value!.Select(summary => summary.Title));
        Assert.Equal(["Top"], top.Value!.Select(summary => summary.Title));
    }

    [Fact]
    public async Task Put_folder_moves_the_situation_and_returns_its_metadata()
    {
        var folder = _folders.Add(AreaReference.Personal(Alice));
        var created = await CreateAsync();

        var result = await SituationEndpoints.MoveAsync(created.Id, new MoveSituationRequest(folder.Id), _service, Cancellation);

        Assert.Equal((folder.Id, 1), (result.Value!.FolderId, result.Value.Revision));

        var back = await SituationEndpoints.MoveAsync(created.Id, new MoveSituationRequest(null), _service, Cancellation);

        Assert.Null(back.Value!.FolderId);
    }

    [Fact]
    public async Task The_folder_endpoints_reject_missing_arguments()
    {
        await Assert.ThrowsAsync<ArgumentNullException>(() => SituationEndpoints.ListInFolderAsync(Guid.NewGuid(), null!, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => SituationEndpoints.CreateInFolderAsync(Guid.NewGuid(), null!, _service, _http.Response, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => SituationEndpoints.MoveAsync(Guid.NewGuid(), null!, _service, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => SituationEndpoints.MoveAsync(Guid.NewGuid(), new MoveSituationRequest(null), null!, Cancellation));
    }
}
