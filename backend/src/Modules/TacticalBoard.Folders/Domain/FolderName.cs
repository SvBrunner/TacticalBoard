using System.Diagnostics.CodeAnalysis;
using TacticalBoard.SharedKernel.Text;

namespace TacticalBoard.Folders.Domain;

/// <summary>
/// A folder's name (arc42 ch. 8.15): trimmed, not empty, at most <see cref="MaxLength"/>
/// characters, no control characters. Unique among the non-deleted folders of an area, compared
/// through <see cref="Normalized"/> (<see cref="UniqueNames"/>: ignoring surrounding whitespace and
/// upper/lower case, like situation titles).
/// </summary>
internal sealed record FolderName
{
    /// <summary>The longest name accepted (UTF-16 code units, like the browser's <c>maxlength</c>). A technical limit.</summary>
    public const int MaxLength = 100;

    private FolderName(string value)
    {
        Value = value;
        Normalized = UniqueNames.Normalize(value);
    }

    /// <summary>The name as stored and shown.</summary>
    public string Value { get; }

    /// <summary>The form names are compared in.</summary>
    public string Normalized { get; }

    /// <summary>Validates a name entered by the user.</summary>
    public static bool TryCreate(string? input, [NotNullWhen(true)] out FolderName? name, [NotNullWhen(false)] out string? error)
    {
        var trimmed = input?.Trim() ?? string.Empty;
        error = trimmed switch
        {
            { Length: 0 } => "must not be empty",
            { Length: > MaxLength } => $"expected at most {MaxLength} characters",
            _ when trimmed.Any(char.IsControl) => "must not contain control characters",
            _ => null,
        };
        name = error is null ? new FolderName(trimmed) : null;
        return error is null;
    }

    /// <inheritdoc />
    public override string ToString() => Value;
}
