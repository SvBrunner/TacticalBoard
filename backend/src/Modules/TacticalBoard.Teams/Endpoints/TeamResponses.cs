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

    /// <summary>
    /// The URL of the team's logo, <c>/api/teams/{code}/logo?v={hash}</c>, or <c>null</c> without
    /// one. The hash makes the URL change with the logo, so a browser never shows an old one.
    /// </summary>
    public static string? LogoUrl(string code, string? logoHash) =>
        logoHash is null ? null : $"/api{TeamEndpoints.TeamsPath}/{code}/logo?v={logoHash}";
}

/// <summary>A team as its page shows it: <c>role</c> is the current user's role, <c>null</c> for a non-member.</summary>
internal sealed record TeamResponse(Guid Id, string Code, string Name, string? LogoUrl, DateTimeOffset CreatedAt, string? Role)
{
    public static TeamResponse From(TeamView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new TeamResponse(
            view.Id,
            view.Code,
            view.Name,
            TeamJson.LogoUrl(view.Code, view.LogoHash),
            view.CreatedAt,
            view.Role is { } role ? TeamJson.Role(role) : null);
    }
}

/// <summary>A team in the overview.</summary>
internal sealed record TeamSummaryResponse(Guid Id, string Code, string Name, string? LogoUrl)
{
    public static TeamSummaryResponse From(TeamSummary summary)
    {
        ArgumentNullException.ThrowIfNull(summary);
        return new TeamSummaryResponse(summary.Id, summary.Code, summary.Name, TeamJson.LogoUrl(summary.Code, summary.LogoHash));
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

/// <summary>A team of the current user, with their role.</summary>
internal sealed record MyTeamResponse(Guid Id, string Code, string Name, string? LogoUrl, string Role)
{
    public static MyTeamResponse From(MemberTeamView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        var team = view.Team;
        return new MyTeamResponse(team.Id, team.Code, team.Name, TeamJson.LogoUrl(team.Code, team.LogoHash), TeamJson.Role(view.Role));
    }
}

/// <summary>The body of <c>PUT /api/teams/{code}</c>: the new name.</summary>
internal sealed record TeamNameRequest(string? Name);
