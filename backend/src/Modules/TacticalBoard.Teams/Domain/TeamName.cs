using System.Diagnostics.CodeAnalysis;
using TacticalBoard.SharedKernel.Text;
using TacticalBoard.SharedKernel.Validation;

namespace TacticalBoard.Teams.Domain;

/// <summary>
/// A team's name (arc42 ch. 8.17): trimmed, not empty, at most <see cref="MaxLength"/> characters,
/// no control characters. Unique among the non-deleted teams, compared through
/// <see cref="Normalized"/> (<see cref="UniqueNames"/>: ignoring surrounding whitespace and
/// upper/lower case, like folder names and situation titles).
/// </summary>
internal sealed record TeamName
{
    /// <summary>
    /// The longest name accepted (UTF-16 code units, like the browser's <c>maxlength</c>): 64, a
    /// technical limit like the one of folder names (arc42 ch. 8.17). The column is <c>varchar(64)</c>.
    /// </summary>
    public const int MaxLength = 64;

    private TeamName(string value)
    {
        Value = value;
        Normalized = UniqueNames.Normalize(value);
    }

    /// <summary>The name as stored and shown.</summary>
    public string Value { get; }

    /// <summary>The form names are compared in.</summary>
    public string Normalized { get; }

    /// <summary>Validates a name entered by the user; <paramref name="error"/> carries a stable code (arc42 ch. 8.2).</summary>
    public static bool TryCreate(string? input, [NotNullWhen(true)] out TeamName? name, [NotNullWhen(false)] out FieldError? error)
    {
        var trimmed = input?.Trim() ?? string.Empty;
        error = trimmed switch
        {
            { Length: 0 } => FieldError.Required(),
            { Length: > MaxLength } => FieldError.TooLong(MaxLength, $"expected at most {MaxLength} characters"),
            _ when trimmed.Any(char.IsControl) => FieldError.ControlCharacters(),
            _ => null,
        };
        name = error is null ? new TeamName(trimmed) : null;
        return error is null;
    }

    /// <inheritdoc />
    public override string ToString() => Value;
}
