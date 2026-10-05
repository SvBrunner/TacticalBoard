using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Teams.Application;

/// <summary>
/// A team as its page shows it, with the current user's role (<c>null</c>: no member). The
/// <paramref name="Code"/> only for members (<c>null</c> for non-members, product decision);
/// <paramref name="JoinRequestPending"/>: the current user has a pending request to join it;
/// <paramref name="PendingJoinRequests"/>: how many requests wait — only for those who decide them
/// (Admins), otherwise <c>null</c>.
/// </summary>
internal sealed record TeamView(
    Guid Id,
    string? Code,
    string Name,
    string? LogoHash,
    DateTimeOffset CreatedAt,
    TeamRole? Role,
    bool JoinRequestPending,
    int? PendingJoinRequests);

/// <summary>A team in a list: name, logo, and the code only if the current user is a member (<c>null</c> otherwise).</summary>
internal sealed record TeamSummary(Guid Id, string? Code, string Name, string? LogoHash);

/// <summary>One page of the team overview: the teams and how many match in total.</summary>
internal sealed record TeamSearchResult(IReadOnlyList<TeamSummary> Teams, int Total, int Offset, int Limit);

/// <summary>A team the current user is a member of, with their role and, for its Admins, the number of pending join requests.</summary>
internal sealed record MemberTeamView(TeamSummary Team, TeamRole Role, int? PendingJoinRequests);

/// <summary>A team's stored logo: the image and its hash (the ETag).</summary>
internal sealed record TeamLogoView(ReadOnlyMemory<byte> Content, string ContentType, string Hash);

/// <summary>A member in the member list: <paramref name="DisplayName"/> is <c>null</c> for a deleted user.</summary>
internal sealed record TeamMemberView(Guid UserId, string? DisplayName, TeamRole Role, DateTimeOffset JoinedAt);

/// <summary>A pending join request: who asked (<paramref name="DisplayName"/> <c>null</c> for a deleted user) and when.</summary>
internal sealed record JoinRequestView(Guid Id, Guid UserId, string? DisplayName, DateTimeOffset RequestedAt);
