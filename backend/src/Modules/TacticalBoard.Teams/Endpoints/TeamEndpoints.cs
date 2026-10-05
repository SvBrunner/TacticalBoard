using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;
using TacticalBoard.SharedKernel.Validation;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Endpoints;

/// <summary>
/// Teams over REST (arc42 ch. 8.17). All need a session (otherwise <c>401</c>); the state-changing
/// ones also the antiforgery header (ch. 8.13).
/// <list type="bullet">
/// <item><c>GET /api/teams?search=&amp;offset=&amp;limit=</c>: the overview, one page of all teams (name, code, logo), searchable by name or code.</item>
/// <item><c>POST /api/teams</c> (multipart: <c>name</c>, optional <c>logo</c>): create; the current user becomes Admin → <c>201</c>, <c>Location</c>.</item>
/// <item><c>GET /api/me/teams</c>: the current user's teams with their role.</item>
/// <item><c>GET /api/teams/{code}</c>: one team, with the current user's role (<c>null</c> for non-members).</item>
/// <item><c>PUT /api/teams/{code}</c> with <c>{ name }</c>: rename (Admins).</item>
/// <item><c>PUT /api/teams/{code}/logo</c> (multipart: <c>logo</c>): set or replace the logo (Admins).</item>
/// <item><c>DELETE /api/teams/{code}/logo</c>: remove the logo (Admins) → <c>204</c>.</item>
/// <item><c>GET /api/teams/{code}/logo</c>: the logo (PNG) with an <c>ETag</c>; <c>304</c> for a matching <c>If-None-Match</c>.</item>
/// </list>
/// </summary>
internal static class TeamEndpoints
{
    public const string TeamsPath = "/teams";
    public const string MyTeamsPath = "/me/teams";
    public const string GetTeamRoute = "GetTeam";

    /// <summary>The form field and validation error key of the team's name.</summary>
    public const string NameField = "name";

    /// <summary>The form field and validation error key of the logo file.</summary>
    public const string LogoField = "logo";

    /// <summary>
    /// The largest request body of an upload: the file limit plus room for the multipart framing and
    /// the name. A larger request is cut off by the server (<c>413</c>) before it is read.
    /// </summary>
    public const long MaxUploadRequestBytes = LogoUpload.MaxBytes + (64 * 1024);

    /// <summary>
    /// The logo response's caching: the browser may keep it but has to revalidate it (cheap, with
    /// the <c>ETag</c>), so a replaced logo shows up everywhere; the logo URLs also change with it.
    /// </summary>
    public const string LogoCacheControl = "private, no-cache";

    public static void Map(IEndpointRouteBuilder api)
    {
        var teams = api.MapGroup(TeamsPath).RequireAuthorization();
        teams.MapGet(string.Empty, SearchAsync);
        // Form endpoints: the app's own middleware checks the antiforgery token of every
        // state-changing request (ch. 8.13), so the framework's form check is not used.
        teams.MapPost(string.Empty, CreateAsync)
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(MaxUploadRequestBytes))
            .WithFormOptions(multipartBodyLengthLimit: MaxUploadRequestBytes);
        teams.MapGet("/{code}", GetAsync).WithName(GetTeamRoute);
        teams.MapPut("/{code}", RenameAsync);
        teams.MapGet("/{code}/logo", GetLogoAsync);
        teams.MapPut("/{code}/logo", SetLogoAsync)
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(MaxUploadRequestBytes))
            .WithFormOptions(multipartBodyLengthLimit: MaxUploadRequestBytes);
        teams.MapDelete("/{code}/logo", RemoveLogoAsync);

        api.MapGroup(MyTeamsPath).RequireAuthorization().MapGet(string.Empty, ListMineAsync);
    }

    public static async Task<Results<Ok<TeamSearchResponse>, ValidationProblem>> SearchAsync(
        [FromQuery] string? search,
        [FromQuery] int? offset,
        [FromQuery] int? limit,
        [FromServices] TeamService service,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        if (!TeamSearch.TryCreate(search, offset, limit, out var query, out var errors))
        {
            return Problem(errors);
        }

        return TypedResults.Ok(TeamSearchResponse.From(await service.SearchAsync(query, cancellationToken)));
    }

    public static async Task<Ok<List<MyTeamResponse>>> ListMineAsync([FromServices] TeamService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        var teams = await service.ListMineAsync(cancellationToken);
        return TypedResults.Ok(teams.Select(MyTeamResponse.From).ToList());
    }

    public static async Task<Results<CreatedAtRoute<TeamResponse>, ValidationProblem>> CreateAsync(
        [FromForm(Name = NameField)] string? name,
        [FromForm(Name = LogoField)] IFormFile? logo,
        [FromServices] TeamService service,
        [FromServices] ILogoImageProcessor processor,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(processor);
        var errors = new FieldErrors();
        if (!TeamName.TryCreate(name, out var teamName, out var nameError))
        {
            errors.Add(NameField, nameError);
        }

        TeamLogoImage? image = null;
        if (logo is not null)
        {
            var processed = await ProcessAsync(logo, processor, cancellationToken);
            if (processed.Error is { } logoError)
            {
                errors.Add(LogoField, logoError);
            }

            image = processed.Logo;
        }

        if (errors.Any || teamName is null)
        {
            return Problem(errors);
        }

        var view = await service.CreateAsync(teamName, image, cancellationToken);
        return TypedResults.CreatedAtRoute(TeamResponse.From(view), GetTeamRoute, new { code = view.Code });
    }

    public static async Task<Ok<TeamResponse>> GetAsync(string code, [FromServices] TeamService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        return TypedResults.Ok(TeamResponse.From(await service.GetAsync(ParseCode(code), cancellationToken)));
    }

    public static async Task<Results<Ok<TeamResponse>, ValidationProblem>> RenameAsync(
        string code,
        [FromBody] TeamNameRequest request,
        [FromServices] TeamService service,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(service);
        var teamCode = ParseCode(code);
        if (!TeamName.TryCreate(request.Name, out var name, out var error))
        {
            return Problem(new FieldErrors().Add(NameField, error));
        }

        return TypedResults.Ok(TeamResponse.From(await service.RenameAsync(teamCode, name, cancellationToken)));
    }

    public static async Task<Results<Ok<TeamResponse>, ValidationProblem>> SetLogoAsync(
        string code,
        [FromForm(Name = LogoField)] IFormFile? logo,
        [FromServices] TeamService service,
        [FromServices] ILogoImageProcessor processor,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        ArgumentNullException.ThrowIfNull(processor);
        var teamCode = ParseCode(code);
        if (logo is null)
        {
            return Problem(new FieldErrors().Add(LogoField, FieldError.Required("a logo file is required")));
        }

        var processed = await ProcessAsync(logo, processor, cancellationToken);
        if (processed.Logo is null)
        {
            return Problem(new FieldErrors().Add(LogoField, processed.Error!));
        }

        return TypedResults.Ok(TeamResponse.From(await service.SetLogoAsync(teamCode, processed.Logo, cancellationToken)));
    }

    public static async Task<NoContent> RemoveLogoAsync(string code, [FromServices] TeamService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        await service.RemoveLogoAsync(ParseCode(code), cancellationToken);
        return TypedResults.NoContent();
    }

    public static async Task<Results<FileContentHttpResult, StatusCodeHttpResult>> GetLogoAsync(
        string code,
        HttpContext context,
        [FromServices] TeamService service,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(service);
        var logo = await service.GetLogoAsync(ParseCode(code), cancellationToken);
        var tag = new EntityTagHeaderValue("\"" + logo.Hash + "\"");
        var headers = context.Response.GetTypedHeaders();
        headers.ETag = tag;
        context.Response.Headers.CacheControl = LogoCacheControl;
        context.Response.Headers.XContentTypeOptions = "nosniff";
        var ifNoneMatch = context.Request.GetTypedHeaders().IfNoneMatch;
        if (ifNoneMatch.Any(candidate => candidate.Equals(EntityTagHeaderValue.Any) || candidate.Compare(tag, useStrongComparison: false)))
        {
            return TypedResults.StatusCode(StatusCodes.Status304NotModified);
        }

        return TypedResults.Bytes(logo.Content, logo.ContentType);
    }

    private static TeamCode ParseCode(string code) =>
        TeamCode.TryParse(code, out var teamCode) ? teamCode : throw new TeamNotFoundException(code);

    private static async Task<LogoProcessingResult> ProcessAsync(IFormFile file, ILogoImageProcessor processor, CancellationToken cancellationToken)
    {
        if (file.Length > LogoUpload.MaxBytes)
        {
            return LogoProcessingResult.Failure(LogoUpload.FileTooLarge());
        }

        using var buffer = new MemoryStream((int)file.Length);
        await using (var stream = file.OpenReadStream())
        {
            await stream.CopyToAsync(buffer, cancellationToken);
        }

        return processor.Process(buffer.GetBuffer().AsSpan(0, (int)buffer.Length));
    }

    private static ValidationProblem Problem(FieldErrors errors) =>
        TypedResults.ValidationProblem(errors.Messages(), extensions: errors.Extensions());
}
