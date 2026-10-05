namespace TacticalBoard.Areas.Contracts;

/// <summary>The kinds of area situations live in (arc42 ch. 5.2, glossary "Area").</summary>
public enum AreaKind
{
    /// <summary>A user's personal area; only its owner may read and write it.</summary>
    Personal,

    /// <summary>A team's area; every member may read it, its Admins and Editors write it (ch. 8.1).</summary>
    Team,
}
