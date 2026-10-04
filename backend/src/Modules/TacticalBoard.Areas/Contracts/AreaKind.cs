namespace TacticalBoard.Areas.Contracts;

/// <summary>The kinds of area situations live in (arc42 ch. 5.2, glossary "Area").</summary>
public enum AreaKind
{
    /// <summary>A user's personal area; only its owner may read and write it.</summary>
    Personal,

    /// <summary>A team's area (Phase 2 step 8; no access rule is registered yet, so access is denied).</summary>
    Team,
}
