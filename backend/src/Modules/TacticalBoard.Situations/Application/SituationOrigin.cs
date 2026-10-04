namespace TacticalBoard.Situations.Application;

/// <summary>
/// Where a situation saved for the first time comes from; decides what happens when its title is
/// taken in the area (arc42 ch. 8.15).
/// </summary>
internal enum SituationOrigin
{
    /// <summary>Created in the app: a taken title is an error, except the default title, which gets the next free number.</summary>
    New,

    /// <summary>Imported from a file: a taken title gets the suffix " (2)" or the next free number.</summary>
    Imported,

    /// <summary>"Save as copy" after a save conflict: like <see cref="Imported"/>.</summary>
    Copy,
}
