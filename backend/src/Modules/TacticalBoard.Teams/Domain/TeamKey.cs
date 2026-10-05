using System.Diagnostics.CodeAnalysis;

namespace TacticalBoard.Teams.Domain;

/// <summary>
/// How a request names a team (arc42 ch. 8.17): by its <see cref="TeamCode"/> (the team's link,
/// <c>/teams/&lt;CODE&gt;</c>) or by its id. Non-members never get a team's code (roadmap Phase 2
/// step 7, product decision), so the overview links them, and logo URLs point, by the id.
/// </summary>
internal sealed record TeamKey
{
    private TeamKey(Guid? id, TeamCode? code)
    {
        Id = id;
        Code = code;
    }

    /// <summary>The team's id, or <c>null</c> when the key is a code.</summary>
    public Guid? Id { get; }

    /// <summary>The team's code, or <c>null</c> when the key is an id.</summary>
    public TeamCode? Code { get; }

    /// <summary>The key of the team with <paramref name="id"/>.</summary>
    public static TeamKey OfId(Guid id) =>
        id == Guid.Empty ? throw new ArgumentException("The id must not be empty.", nameof(id)) : new TeamKey(id, null);

    /// <summary>The key of the team with <paramref name="code"/>.</summary>
    public static TeamKey OfCode(TeamCode code)
    {
        ArgumentNullException.ThrowIfNull(code);
        return new TeamKey(null, code);
    }

    /// <summary>Reads a key: a UUID (the id) or a six-character code (any case); <c>false</c> for anything else.</summary>
    public static bool TryParse(string? text, [NotNullWhen(true)] out TeamKey? key)
    {
        if (Guid.TryParse(text, out var id) && id != Guid.Empty)
        {
            key = OfId(id);
            return true;
        }

        key = TeamCode.TryParse(text, out var code) ? OfCode(code) : null;
        return key is not null;
    }

    /// <summary>Whether <paramref name="team"/> is the team this key names.</summary>
    public bool Matches(Team team)
    {
        ArgumentNullException.ThrowIfNull(team);
        return Id is { } id ? team.Id == id : team.Code == Code!.Value;
    }

    /// <inheritdoc />
    public override string ToString() => Id?.ToString() ?? Code!.Value;
}
