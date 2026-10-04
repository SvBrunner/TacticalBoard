using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Application;

/// <summary>The identities configured as system administrators from the start (<c>Bootstrap__SystemAdministrators</c>, arc42 ch. 8.14).</summary>
internal sealed class BootstrapAdministrators
{
    private readonly HashSet<ExternalIdentity> _identities;

    public BootstrapAdministrators(IEnumerable<ExternalIdentity> identities)
    {
        ArgumentNullException.ThrowIfNull(identities);
        _identities = [.. identities];
    }

    /// <summary>No configured identities.</summary>
    public static BootstrapAdministrators None { get; } = new([]);

    public IReadOnlyCollection<ExternalIdentity> Identities => _identities;

    public bool Contains(ExternalIdentity identity) => _identities.Contains(identity);
}
