using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Time;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Teams.Application;

/// <summary>
/// Join requests (arc42 ch. 1, 8.17): a logged-in non-member asks to join a team (also after arriving
/// through its link); one pending request per user and team, which can't be withdrawn; the team's
/// Admins see the pending requests and accept (the user becomes a Reader) or reject them; after a
/// rejection the user may ask again. Every change runs with the team locked (<see cref="TeamLocks"/>),
/// so two Admins deciding the same request, or a request and a deletion of the team, don't collide.
/// </summary>
internal sealed class TeamJoinRequestService(
    ITeamRepository teams,
    ITeamJoinRequestRepository joinRequests,
    ITeamMembershipRepository memberships,
    ITeamAuthorization authorization,
    TeamMemberNames names,
    TeamLocks locks,
    ICurrentUser currentUser,
    IIdGenerator ids,
    IClock clock)
{
    /// <summary>The current user asks to join the team.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="AlreadyTeamMemberException">They are a member already.</exception>
    /// <exception cref="JoinRequestPendingException">They have a pending request for it already.</exception>
    public Task<JoinRequestView> SendAsync(TeamKey key, CancellationToken cancellationToken) =>
        locks.RunAsync(
            key,
            async (team, cancellation) =>
            {
                var userId = currentUser.Id;
                if (await authorization.RoleOfCurrentUserAsync(team.Id, cancellation) is not null)
                {
                    throw new AlreadyTeamMemberException();
                }

                if (await joinRequests.HasPendingAsync(team.Id, userId, cancellation))
                {
                    throw new JoinRequestPendingException();
                }

                var request = TeamJoinRequest.Send(ids.NewId(), team, userId, clock.UtcNow);
                joinRequests.Add(request);
                try
                {
                    await joinRequests.SaveChangesAsync(cancellation);
                }
                catch (JoinRequestUniquenessViolationException)
                {
                    throw new JoinRequestPendingException();
                }

                return View(request, await names.OfAsync(userId, cancellation));
            },
            cancellationToken);

    /// <summary>The team's pending requests, oldest first. Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    public async Task<IReadOnlyList<JoinRequestView>> ListPendingAsync(TeamKey key, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(key);
        var team = await teams.FindAsync(key, cancellationToken) ?? throw new TeamNotFoundException(key.ToString());
        await EnsureCanDecideAsync(team, cancellationToken);
        var pending = await joinRequests.ListPendingAsync(team.Id, cancellationToken);
        var displayNames = await names.OfAsync(pending.Select(request => request.UserId), cancellationToken);
        return pending.Select(request => View(request, displayNames.GetValueOrDefault(request.UserId))).ToList();
    }

    /// <summary>Accepts the pending request <paramref name="requestId"/>: its user becomes a Reader. Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    /// <exception cref="JoinRequestNotFoundException">There is no such pending request (any more).</exception>
    public Task<TeamMemberView> AcceptAsync(TeamKey key, Guid requestId, CancellationToken cancellationToken) =>
        locks.RunAsync(
            key,
            async (team, cancellation) =>
            {
                var request = await FindDecidableAsync(team, requestId, cancellation);
                var now = clock.UtcNow;
                request.Accept(now, currentUser.Id);
                var membership = TeamMembership.ForAcceptedRequest(ids.NewId(), request, now);
                memberships.Add(membership);
                await joinRequests.SaveChangesAsync(cancellation);
                return new TeamMemberView(membership.UserId, await names.OfAsync(membership.UserId, cancellation), membership.Role, membership.JoinedAt);
            },
            cancellationToken);

    /// <summary>Rejects the pending request <paramref name="requestId"/>; its user may ask again. Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    /// <exception cref="JoinRequestNotFoundException">There is no such pending request (any more).</exception>
    public Task RejectAsync(TeamKey key, Guid requestId, CancellationToken cancellationToken) =>
        locks.RunAsync(
            key,
            async (team, cancellation) =>
            {
                var request = await FindDecidableAsync(team, requestId, cancellation);
                request.Reject(clock.UtcNow, currentUser.Id);
                await joinRequests.SaveChangesAsync(cancellation);
                return true;
            },
            cancellationToken);

    private async Task<TeamJoinRequest> FindDecidableAsync(Team team, Guid requestId, CancellationToken cancellationToken)
    {
        await EnsureCanDecideAsync(team, cancellationToken);
        return await joinRequests.FindPendingAsync(team.Id, requestId, cancellationToken) ?? throw new JoinRequestNotFoundException(requestId);
    }

    private async Task EnsureCanDecideAsync(Team team, CancellationToken cancellationToken)
    {
        if (!await authorization.CanDecideJoinRequestsAsync(team.Id, cancellationToken))
        {
            throw new TeamAccessDeniedException("Only the team's Admins may see, accept and reject join requests.");
        }
    }

    private static JoinRequestView View(TeamJoinRequest request, string? displayName) =>
        new(request.Id, request.UserId, displayName, request.RequestedAt);
}
