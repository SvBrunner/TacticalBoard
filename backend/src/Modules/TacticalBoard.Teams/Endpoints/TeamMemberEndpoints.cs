using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using TacticalBoard.SharedKernel.Validation;
using TacticalBoard.Teams.Application;

namespace TacticalBoard.Teams.Endpoints;

/// <summary>
/// A team's members and join requests over REST (arc42 ch. 8.17), below <c>/api/teams/{team}</c>
/// (<c>{team}</c>: code or id). All need a session; the state-changing ones the antiforgery header.
/// <list type="bullet">
/// <item><c>GET …/members</c>: the member list (members only).</item>
/// <item><c>PUT …/members/{userId}/role</c> with <c>{ role }</c>: change a role (Admins).</item>
/// <item><c>DELETE …/members/{userId}</c>: remove a member (Admins) → <c>204</c>.</item>
/// <item><c>DELETE …/members/me</c>: leave the team → <c>204</c>.</item>
/// <item><c>POST …/join-requests</c>: ask to join → <c>201</c>.</item>
/// <item><c>GET …/join-requests</c>: the pending requests (Admins).</item>
/// <item><c>POST …/join-requests/{requestId}/accept</c>: accept (Admins) → the new member.</item>
/// <item><c>POST …/join-requests/{requestId}/reject</c>: reject (Admins) → <c>204</c>.</item>
/// </list>
/// </summary>
internal static class TeamMemberEndpoints
{
    /// <summary>The body field and validation error key of a new role.</summary>
    public const string RoleField = "role";

    public static void Map(IEndpointRouteBuilder teams)
    {
        teams.MapGet("/{team}/members", ListMembersAsync);
        teams.MapPut("/{team}/members/{userId:guid}/role", ChangeRoleAsync);
        teams.MapDelete("/{team}/members/{userId:guid}", RemoveMemberAsync);
        teams.MapDelete("/{team}/members/me", LeaveAsync);
        teams.MapPost("/{team}/join-requests", SendJoinRequestAsync);
        teams.MapGet("/{team}/join-requests", ListJoinRequestsAsync);
        teams.MapPost("/{team}/join-requests/{requestId:guid}/accept", AcceptJoinRequestAsync);
        teams.MapPost("/{team}/join-requests/{requestId:guid}/reject", RejectJoinRequestAsync);
    }

    public static async Task<Ok<List<TeamMemberResponse>>> ListMembersAsync(string team, [FromServices] TeamMembershipService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        var members = await service.ListAsync(TeamEndpoints.ParseKey(team), cancellationToken);
        return TypedResults.Ok(members.Select(TeamMemberResponse.From).ToList());
    }

    public static async Task<Results<Ok<TeamMemberResponse>, ValidationProblem>> ChangeRoleAsync(
        string team,
        Guid userId,
        [FromBody] TeamRoleRequest request,
        [FromServices] TeamMembershipService service,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(service);
        var key = TeamEndpoints.ParseKey(team);
        if (string.IsNullOrWhiteSpace(request.Role))
        {
            return TeamEndpoints.Problem(new FieldErrors().Add(RoleField, FieldError.Required("a role is required")));
        }

        if (!TeamJson.TryParseRole(request.Role, out var role))
        {
            return TeamEndpoints.Problem(new FieldErrors().Add(RoleField, FieldError.Of("invalid-value", "expected \"admin\", \"editor\" or \"reader\"")));
        }

        return TypedResults.Ok(TeamMemberResponse.From(await service.ChangeRoleAsync(key, userId, role, cancellationToken)));
    }

    public static async Task<NoContent> RemoveMemberAsync(string team, Guid userId, [FromServices] TeamMembershipService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        await service.RemoveAsync(TeamEndpoints.ParseKey(team), userId, cancellationToken);
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> LeaveAsync(string team, [FromServices] TeamMembershipService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        await service.LeaveAsync(TeamEndpoints.ParseKey(team), cancellationToken);
        return TypedResults.NoContent();
    }

    public static async Task<Created<JoinRequestResponse>> SendJoinRequestAsync(string team, [FromServices] TeamJoinRequestService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        var request = await service.SendAsync(TeamEndpoints.ParseKey(team), cancellationToken);
        return TypedResults.Created((string?)null, JoinRequestResponse.From(request));
    }

    public static async Task<Ok<List<JoinRequestResponse>>> ListJoinRequestsAsync(string team, [FromServices] TeamJoinRequestService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        var requests = await service.ListPendingAsync(TeamEndpoints.ParseKey(team), cancellationToken);
        return TypedResults.Ok(requests.Select(JoinRequestResponse.From).ToList());
    }

    public static async Task<Ok<TeamMemberResponse>> AcceptJoinRequestAsync(string team, Guid requestId, [FromServices] TeamJoinRequestService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        return TypedResults.Ok(TeamMemberResponse.From(await service.AcceptAsync(TeamEndpoints.ParseKey(team), requestId, cancellationToken)));
    }

    public static async Task<NoContent> RejectJoinRequestAsync(string team, Guid requestId, [FromServices] TeamJoinRequestService service, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(service);
        await service.RejectAsync(TeamEndpoints.ParseKey(team), requestId, cancellationToken);
        return TypedResults.NoContent();
    }
}
