using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Teams.Application;

/// <summary>A team as its page shows it, with the current user's role (<c>null</c>: no member).</summary>
internal sealed record TeamView(Guid Id, string Code, string Name, string? LogoHash, DateTimeOffset CreatedAt, TeamRole? Role);

/// <summary>A team in a list: name, code, logo.</summary>
internal sealed record TeamSummary(Guid Id, string Code, string Name, string? LogoHash);

/// <summary>One page of the team overview: the teams and how many match in total.</summary>
internal sealed record TeamSearchResult(IReadOnlyList<TeamSummary> Teams, int Total, int Offset, int Limit);

/// <summary>A team the current user is a member of, with their role.</summary>
internal sealed record MemberTeamView(TeamSummary Team, TeamRole Role);

/// <summary>A team's stored logo: the image and its hash (the ETag).</summary>
internal sealed record TeamLogoView(ReadOnlyMemory<byte> Content, string ContentType, string Hash);
