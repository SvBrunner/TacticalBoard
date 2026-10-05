using System.Security.Cryptography;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary>
/// <see cref="ITeamCodeGenerator"/> with a cryptographically secure random number generator, so codes
/// can't be predicted from earlier ones (each of the 36⁶ ≈ 2.2 billion codes is equally likely).
/// </summary>
internal sealed class RandomTeamCodeGenerator : ITeamCodeGenerator
{
    /// <inheritdoc />
    public TeamCode NewCode() => TeamCode.Parse(RandomNumberGenerator.GetString(TeamCode.Alphabet, TeamCode.Length));
}
