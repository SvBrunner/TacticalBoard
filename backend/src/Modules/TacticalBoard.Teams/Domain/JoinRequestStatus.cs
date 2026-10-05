namespace TacticalBoard.Teams.Domain;

/// <summary>Where a <see cref="TeamJoinRequest"/> stands.</summary>
internal enum JoinRequestStatus
{
    /// <summary>Sent, waiting for a team Admin; it can't be withdrawn.</summary>
    Pending,

    /// <summary>Accepted by a team Admin: the user became a member (Reader).</summary>
    Accepted,

    /// <summary>Rejected by a team Admin; the user may send a new request.</summary>
    Rejected,
}
