using System.Globalization;
using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Persistence;
using TacticalBoard.SharedKernel.Time;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Teams.Application;

/// <summary>
/// The use cases of teams of roadmap Phase 2 step 6 (arc42 ch. 8.17): the overview with search, the
/// current user's teams, a team's page, creating a team (its creator becomes Admin), renaming it and
/// setting or removing its logo (Admins only, through <see cref="ITeamAuthorization"/>).
/// Every logged-in user may see every team's public data (name, code, logo).
/// </summary>
internal sealed class TeamService(
    ITeamRepository teams,
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
        return new TeamSearchResult(found.Select(Summary).ToList(), total, search.Offset, search.Limit);
    }

    /// <summary>The teams the current user is a member of, with their role, by name (ignoring case, then exactly).</summary>
    public async Task<IReadOnlyList<MemberTeamView>> ListMineAsync(CancellationToken cancellationToken)
    {
        var list = await teams.ListOfMemberAsync(currentUser.Id, cancellationToken);
        return list
            .OrderBy(entry => entry.Team.Name, StringComparer.Create(CultureInfo.InvariantCulture, CompareOptions.IgnoreCase))
            .ThenBy(entry => entry.Team.Name, StringComparer.Ordinal)
            .Select(entry => new MemberTeamView(Summary(entry.Team), entry.Role))
            .ToList();
    }

    /// <summary>The team with <paramref name="code"/>, with the current user's role.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    public async Task<TeamView> GetAsync(TeamCode code, CancellationToken cancellationToken)
    {
        var team = await FindAsync(code, cancellationToken);
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

            return View(team, creator.Role);
        }

        throw new InvalidOperationException($"No free team code found in {MaxCodeAttempts} attempts.");
    }

    /// <summary>Renames the team; its own name (e.g. in another case) is no conflict. Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    /// <exception cref="DuplicateTeamNameException">Another team has the name.</exception>
    public async Task<TeamView> RenameAsync(TeamCode code, TeamName name, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(name);
        var team = await FindChangeableAsync(code, cancellationToken);
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

        return View(team, TeamRole.Admin);
    }

    /// <summary>Sets or replaces the team's logo. Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    public async Task<TeamView> SetLogoAsync(TeamCode code, TeamLogoImage logo, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(logo);
        var team = await FindChangeableAsync(code, cancellationToken);
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
        return View(team, TeamRole.Admin);
    }

    /// <summary>Removes the team's logo (nothing happens without one). Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    public async Task<TeamView> RemoveLogoAsync(TeamCode code, CancellationToken cancellationToken)
    {
        var team = await FindChangeableAsync(code, cancellationToken);
        await transactions.InTransactionAsync(
            async cancellation =>
            {
                await teams.DeleteLogoAsync(team.Id, cancellation);
                team.ChangeLogo(null, clock.UtcNow, currentUser.Id);
                await teams.SaveChangesAsync(cancellation);
                return true;
            },
            cancellationToken);
        return View(team, TeamRole.Admin);
    }

    /// <summary>The team's logo.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamLogoNotFoundException">It has no logo.</exception>
    public async Task<TeamLogoView> GetLogoAsync(TeamCode code, CancellationToken cancellationToken)
    {
        var team = await FindAsync(code, cancellationToken);
        var logo = await teams.FindLogoAsync(team.Id, cancellationToken) ?? throw new TeamLogoNotFoundException(code.Value);
        return new TeamLogoView(logo.Content, logo.ContentType, logo.Hash);
    }

    private async Task<Team> FindAsync(TeamCode code, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(code);
        return await teams.FindByCodeAsync(code, cancellationToken) ?? throw new TeamNotFoundException(code.Value);
    }

    private async Task<Team> FindChangeableAsync(TeamCode code, CancellationToken cancellationToken)
    {
        var team = await FindAsync(code, cancellationToken);
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

    private async Task<TeamView> ViewAsync(Team team, CancellationToken cancellationToken) =>
        View(team, await authorization.RoleOfCurrentUserAsync(team.Id, cancellationToken));

    private static TeamView View(Team team, TeamRole? role) => new(team.Id, team.Code, team.Name, team.LogoHash, team.CreatedAt, role);

    private static TeamSummary Summary(Team team) => new(team.Id, team.Code, team.Name, team.LogoHash);
}
