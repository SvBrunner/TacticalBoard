using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Application;

/// <summary>Generates team codes (arc42 ch. 8.17): random, six characters from A–Z and 0–9. Uniqueness is the caller's business.</summary>
internal interface ITeamCodeGenerator
{
    /// <summary>A new random code.</summary>
    TeamCode NewCode();
}
