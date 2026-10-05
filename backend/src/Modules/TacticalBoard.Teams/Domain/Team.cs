using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.Teams.Domain;

/// <summary>
/// A team (arc42 ch. 1, 8.17): a unique name (among non-deleted teams), an optional logo, and a
/// system-generated code that never changes. Soft-deleted (ch. 8.16; deleting teams comes with
/// roadmap Phase 2 step 7). Its members are <see cref="TeamMembership"/>s.
/// </summary>
internal sealed class Team : SoftDeletableEntity
{
    // For EF Core.
    private Team()
    {
        Name = string.Empty;
        NormalizedName = string.Empty;
        Code = string.Empty;
    }

    public Guid Id { get; private set; }

    public string Name { get; private set; }

    /// <summary><see cref="TeamName.Normalized"/> of <see cref="Name"/>; unique among non-deleted teams.</summary>
    public string NormalizedName { get; private set; }

    /// <summary>The <see cref="TeamCode"/>; unique among all teams (also deleted ones), never changed.</summary>
    public string Code { get; private set; }

    /// <summary>The <see cref="TeamLogoImage.Hash"/> of the current logo, or <c>null</c> without a logo.</summary>
    public string? LogoHash { get; private set; }

    /// <summary>Whether the team has a logo.</summary>
    public bool HasLogo => LogoHash is not null;

    public DateTimeOffset CreatedAt { get; private set; }

    public Guid CreatedBy { get; private set; }

    /// <summary>When the team's name or logo last changed.</summary>
    public DateTimeOffset UpdatedAt { get; private set; }

    public Guid UpdatedBy { get; private set; }

    /// <summary>A new team, created by <paramref name="by"/> (who becomes its Admin, <see cref="TeamMembership.ForCreator"/>).</summary>
    public static Team Create(Guid id, TeamName name, TeamCode code, DateTimeOffset at, Guid by)
    {
        ArgumentNullException.ThrowIfNull(name);
        ArgumentNullException.ThrowIfNull(code);
        if (id == Guid.Empty)
        {
            throw new ArgumentException("The id must not be empty.", nameof(id));
        }

        var team = new Team { Id = id, Code = code.Value, CreatedAt = at, CreatedBy = by };
        team.Rename(name, at, by);
        return team;
    }

    /// <summary>Gives the team another name (uniqueness is checked by the service and the database).</summary>
    public void Rename(TeamName name, DateTimeOffset at, Guid by)
    {
        ArgumentNullException.ThrowIfNull(name);
        Name = name.Value;
        NormalizedName = name.Normalized;
        Touch(at, by);
    }

    /// <summary>Records that the logo is now <paramref name="logo"/> (<c>null</c>: removed); the image itself is a <see cref="TeamLogo"/>.</summary>
    public void ChangeLogo(TeamLogoImage? logo, DateTimeOffset at, Guid by)
    {
        LogoHash = logo?.Hash;
        Touch(at, by);
    }

    private void Touch(DateTimeOffset at, Guid by)
    {
        UpdatedAt = at;
        UpdatedBy = by;
    }
}
