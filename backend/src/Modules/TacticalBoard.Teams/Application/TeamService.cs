using System.Globalization;
using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Persistence;
using TacticalBoard.SharedKernel.Time;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Teams.Application;

/// <summary>
/// The use cases of teams themselves (arc42 ch. 8.17): the overview with search, the current user's
/// teams, a team's page, creating a team (its creator becomes Admin), renaming it and setting or
/// removing its logo (Admins only, through <see cref="ITeamAuthorization"/>).
/// Every logged-in user may see every team's name and logo; its code only its members (product
/// decision, roadmap Phase 2 step 7). Members and join requests: <see cref="TeamMembershipService"/>,
/// <see cref="TeamJoinRequestService"/>; deleting: <see cref="TeamDeletionService"/>.
/// </summary>
internal sealed class TeamService(
    ITeamRepository teams,
    ITeamJoinRequestRepository joinRequests,
    ITeamAuthorization authorization,
    ICurrentUser currentUser,
    ITeamCodeGenerator codes,
    IUnitOfWork transactions,
    IIdGenerator ids,
    IClock clock)
{
    /// <summary>How many random codes are tried before giving up (with 36⁶ codes a collision is already rare).</summary>
    public const int MaxCodeAttempts = 10;

    /// <summary>One page of the teams matching <paramref name="search"/>.</summary>
    public async Task<TeamSearchResult> SearchAsync(TeamSearch search, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(search);
        var (found, total) = await teams.SearchAsync(search.NameFragment, search.CodeFragment, search.Offset, search.Limit, cancellationToken);
        var mine = (await teams.ListOfMemberAsync(currentUser.Id, cancellationToken)).Select(entry => entry.Team.Id).ToHashSet();
        return new TeamSearchResult(found.Select(team => Summary(team, mine.Contains(team.Id))).ToList(), total, search.Offset, search.Limit);
    }

    /// <summary>The teams the current user is a member of, with their role, by name (ignoring case, then exactly).</summary>
    public async Task<IReadOnlyList<MemberTeamView>> ListMineAsync(CancellationToken cancellationToken)
    {
        var list = await teams.ListOfMemberAsync(currentUser.Id, cancellationToken);
        var decided = list.Where(entry => TeamPermissions.Allows(entry.Role, TeamPermission.DecideJoinRequests)).Select(entry => entry.Team.Id).ToList();
        var pending = decided.Count == 0 ? new Dictionary<Guid, int>() : await joinRequests.CountPendingAsync(decided, cancellationToken);
        return list
            .OrderBy(entry => entry.Team.Name, StringComparer.Create(CultureInfo.InvariantCulture, CompareOptions.IgnoreCase))
            .ThenBy(entry => entry.Team.Name, StringComparer.Ordinal)
            .Select(entry => new MemberTeamView(
                Summary(entry.Team, isMember: true),
                entry.Role,
                decided.Contains(entry.Team.Id) ? pending.GetValueOrDefault(entry.Team.Id) : null))
            .ToList();
    }

    /// <summary>The team named by <paramref name="key"/>, with the current user's role and join request state.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    public async Task<TeamView> GetAsync(TeamKey key, CancellationToken cancellationToken)
    {
        var team = await FindAsync(key, cancellationToken);
        return await ViewAsync(team, cancellationToken);
    }

    /// <summary>Creates a team with a new random code, optionally with a logo; the current user becomes its Admin.</summary>
    /// <exception cref="DuplicateTeamNameException">The name is taken.</exception>
    public async Task<TeamView> CreateAsync(TeamName name, TeamLogoImage? logo, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(name);
        await EnsureNameIsFreeAsync(name, exceptTeamId: null, cancellationToken);
        var by = currentUser.Id;
        for (var attempt = 0; attempt < MaxCodeAttempts; attempt++)
        {
            var code = codes.NewCode();
            if (await teams.IsCodeTakenAsync(code, cancellationToken))
            {
                continue;
            }

            var now = clock.UtcNow;
            var team = Team.Create(ids.NewId(), name, code, now, by);
            team.ChangeLogo(logo, now, by);
            var creator = TeamMembership.ForCreator(ids.NewId(), team);
            try
            {
                await teams.AddAsync(team, creator, logo is null ? null : TeamLogo.Of(team.Id, logo, now, by), cancellationToken);
            }
            catch (TeamCodeUniquenessViolationException)
            {
                continue;
            }
            catch (TeamNameUniquenessViolationException)
            {
                throw new DuplicateTeamNameException(name.Value);
            }

            return new TeamView(team.Id, team.Code, team.Name, team.LogoHash, team.CreatedAt, creator.Role, JoinRequestPending: false, PendingJoinRequests: 0);
        }

        throw new InvalidOperationException($"No free team code found in {MaxCodeAttempts} attempts.");
    }

    /// <summary>Renames the team; its own name (e.g. in another case) is no conflict. Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    /// <exception cref="DuplicateTeamNameException">Another team has the name.</exception>
    public async Task<TeamView> RenameAsync(TeamKey key, TeamName name, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(name);
        var team = await FindChangeableAsync(key, cancellationToken);
        await EnsureNameIsFreeAsync(name, team.Id, cancellationToken);
        team.Rename(name, clock.UtcNow, currentUser.Id);
        try
        {
            await teams.SaveChangesAsync(cancellationToken);
        }
        catch (TeamNameUniquenessViolationException)
        {
            throw new DuplicateTeamNameException(name.Value);
        }

        return await ViewAsync(team, cancellationToken);
    }

    /// <summary>Sets or replaces the team's logo. Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    public async Task<TeamView> SetLogoAsync(TeamKey key, TeamLogoImage logo, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(logo);
        var team = await FindChangeableAsync(key, cancellationToken);
        var now = clock.UtcNow;
        var by = currentUser.Id;
        await transactions.InTransactionAsync(
            async cancellation =>
            {
                await teams.SaveLogoAsync(TeamLogo.Of(team.Id, logo, now, by), cancellation);
                team.ChangeLogo(logo, now, by);
                await teams.SaveChangesAsync(cancellation);
                return true;
            },
            cancellationToken);
        return await ViewAsync(team, cancellationToken);
    }

    /// <summary>Removes the team's logo (nothing happens without one). Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    public async Task<TeamView> RemoveLogoAsync(TeamKey key, CancellationToken cancellationToken)
    {
        var team = await FindChangeableAsync(key, cancellationToken);
        await transactions.InTransactionAsync(
            async cancellation =>
            {
                await teams.DeleteLogoAsync(team.Id, cancellation);
                team.ChangeLogo(null, clock.UtcNow, currentUser.Id);
                await teams.SaveChangesAsync(cancellation);
                return true;
            },
            cancellationToken);
        return await ViewAsync(team, cancellationToken);
    }

    /// <summary>The team's logo.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamLogoNotFoundException">It has no logo.</exception>
    public async Task<TeamLogoView> GetLogoAsync(TeamKey key, CancellationToken cancellationToken)
    {
        var team = await FindAsync(key, cancellationToken);
        var logo = await teams.FindLogoAsync(team.Id, cancellationToken) ?? throw new TeamLogoNotFoundException(key.ToString());
        return new TeamLogoView(logo.Content, logo.ContentType, logo.Hash);
    }

    private async Task<Team> FindAsync(TeamKey key, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(key);
        return await teams.FindAsync(key, cancellationToken) ?? throw new TeamNotFoundException(key.ToString());
    }

    private async Task<Team> FindChangeableAsync(TeamKey key, CancellationToken cancellationToken)
    {
        var team = await FindAsync(key, cancellationToken);
        if (!await authorization.CanChangeDetailsAsync(team.Id, cancellationToken))
        {
            throw new TeamAccessDeniedException();
        }

        return team;
    }

    private async Task EnsureNameIsFreeAsync(TeamName name, Guid? exceptTeamId, CancellationToken cancellationToken)
    {
        if (await teams.IsNameTakenAsync(name.Normalized, exceptTeamId, cancellationToken))
        {
            throw new DuplicateTeamNameException(name.Value);
        }
    }

    private async Task<TeamView> ViewAsync(Team team, CancellationToken cancellationToken)
    {
        var role = await authorization.RoleOfCurrentUserAsync(team.Id, cancellationToken);
        var isMember = role is not null;
        var joinRequestPending = !isMember && await joinRequests.HasPendingAsync(team.Id, currentUser.Id, cancellationToken);
        int? pending = TeamPermissions.Allows(role, TeamPermission.DecideJoinRequests)
            ? (await joinRequests.CountPendingAsync([team.Id], cancellationToken)).GetValueOrDefault(team.Id)
            : null;
        return new TeamView(team.Id, isMember ? team.Code : null, team.Name, team.LogoHash, team.CreatedAt, role, joinRequestPending, pending);
    }

    private static TeamSummary Summary(Team team, bool isMember) => new(team.Id, isMember ? team.Code : null, team.Name, team.LogoHash);
}
