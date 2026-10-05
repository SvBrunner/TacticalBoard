using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Teams.Endpoints;

/// <summary>How teams appear in the API (arc42 ch. 8.17): roles in lower case, the logo as a versioned URL.</summary>
internal static class TeamJson
{
    /// <summary>A role as the API names it: <c>admin</c>, <c>editor</c>, <c>reader</c>.</summary>
    public static string Role(TeamRole role) => role switch
    {
        TeamRole.Admin => "admin",
        TeamRole.Editor => "editor",
        TeamRole.Reader => "reader",
        _ => throw new ArgumentOutOfRangeException(nameof(role), role, "Unknown team role."),
    };

    /// <summary>Reads a role as the API names it (any case); <c>false</c> for anything else.</summary>
    public static bool TryParseRole(string? text, out TeamRole role)
    {
        switch (text?.Trim().ToLowerInvariant())
        {
            case "admin":
                role = TeamRole.Admin;
                return true;
            case "editor":
                role = TeamRole.Editor;
                return true;
            case "reader":
                role = TeamRole.Reader;
                return true;
            default:
                role = default;
                return false;
        }
    }

    /// <summary>
    /// The URL of the team's logo, <c>/api/teams/{id}/logo?v={hash}</c>, or <c>null</c> without
    /// one. By the id, not the code, so it doesn't give non-members the code. The hash makes the URL
    /// change with the logo, so a browser never shows an old one.
    /// </summary>
    public static string? LogoUrl(Guid teamId, string? logoHash) =>
        logoHash is null ? null : $"/api{TeamEndpoints.TeamsPath}/{teamId}/logo?v={logoHash}";
}

/// <summary>
/// A team as its page shows it: <c>role</c> is the current user's role, <c>null</c> for a non-member;
/// <c>code</c> only for members; <c>joinRequestPending</c>: the current user asked to join and waits;
/// <c>pendingJoinRequests</c>: the number of waiting requests, for Admins only (<c>null</c> otherwise).
/// </summary>
internal sealed record TeamResponse(
    Guid Id,
    string? Code,
    string Name,
    string? LogoUrl,
    DateTimeOffset CreatedAt,
    string? Role,
    bool JoinRequestPending,
    int? PendingJoinRequests)
{
    public static TeamResponse From(TeamView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new TeamResponse(
            view.Id,
            view.Code,
            view.Name,
            TeamJson.LogoUrl(view.Id, view.LogoHash),
            view.CreatedAt,
            view.Role is { } role ? TeamJson.Role(role) : null,
            view.JoinRequestPending,
            view.PendingJoinRequests);
    }
}

/// <summary>A team in the overview: <c>code</c> only for the user's own teams.</summary>
internal sealed record TeamSummaryResponse(Guid Id, string? Code, string Name, string? LogoUrl)
{
    public static TeamSummaryResponse From(TeamSummary summary)
    {
        ArgumentNullException.ThrowIfNull(summary);
        return new TeamSummaryResponse(summary.Id, summary.Code, summary.Name, TeamJson.LogoUrl(summary.Id, summary.LogoHash));
    }
}

/// <summary>One page of the team overview: <c>items</c> and the number of all matching teams.</summary>
internal sealed record TeamSearchResponse(List<TeamSummaryResponse> Items, int Total, int Offset, int Limit)
{
    public static TeamSearchResponse From(TeamSearchResult result)
    {
        ArgumentNullException.ThrowIfNull(result);
        return new TeamSearchResponse(result.Teams.Select(TeamSummaryResponse.From).ToList(), result.Total, result.Offset, result.Limit);
    }
}

/// <summary>A team of the current user, with their role and, for its Admins, the number of pending join requests (<c>null</c> otherwise).</summary>
internal sealed record MyTeamResponse(Guid Id, string Code, string Name, string? LogoUrl, string Role, int? PendingJoinRequests)
{
    public static MyTeamResponse From(MemberTeamView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        var team = view.Team;
        return new MyTeamResponse(
            team.Id,
            team.Code ?? throw new InvalidOperationException("A member's team has a code."),
            team.Name,
            TeamJson.LogoUrl(team.Id, team.LogoHash),
            TeamJson.Role(view.Role),
            view.PendingJoinRequests);
    }
}

/// <summary>A member in the member list: <c>displayName</c> is <c>null</c> for a deleted user.</summary>
internal sealed record TeamMemberResponse(Guid UserId, string? DisplayName, string Role, DateTimeOffset JoinedAt)
{
    public static TeamMemberResponse From(TeamMemberView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new TeamMemberResponse(view.UserId, view.DisplayName, TeamJson.Role(view.Role), view.JoinedAt);
    }
}

/// <summary>A pending join request: <c>user</c> is who asked (<c>displayName</c> <c>null</c> for a deleted user).</summary>
internal sealed record JoinRequestResponse(Guid Id, JoinRequestUserResponse User, DateTimeOffset RequestedAt)
{
    public static JoinRequestResponse From(JoinRequestView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new JoinRequestResponse(view.Id, new JoinRequestUserResponse(view.UserId, view.DisplayName), view.RequestedAt);
    }
}

/// <summary>The user of a join request.</summary>
internal sealed record JoinRequestUserResponse(Guid Id, string? DisplayName);

/// <summary>The body of <c>PUT /api/teams/{team}/members/{userId}/role</c>: <c>admin</c>, <c>editor</c> or <c>reader</c>.</summary>
internal sealed record TeamRoleRequest(string? Role);

/// <summary>The body of <c>PUT /api/teams/{team}</c>: the new name.</summary>
internal sealed record TeamNameRequest(string? Name);
