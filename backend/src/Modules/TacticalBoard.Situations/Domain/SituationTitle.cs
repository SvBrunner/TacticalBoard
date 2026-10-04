using System.Diagnostics.CodeAnalysis;
using TacticalBoard.SharedKernel.Text;

namespace TacticalBoard.Situations.Domain;

/// <summary>
/// A saved situation's title (arc42 ch. 8.15): trimmed; a blank title becomes the
/// <see cref="Default"/> title; at most <see cref="MaxLength"/> characters. Titles are unique
/// within an area, compared through <see cref="Normalized"/> (trimmed, Unicode NFC, upper case
/// invariant), i.e. ignoring surrounding whitespace and upper/lower case.
/// </summary>
internal sealed record SituationTitle
{
    /// <summary>The longest title accepted on saving (UTF-16 code units). A technical limit; numbered titles may exceed it by their suffix.</summary>
    public const int MaxLength = 200;

    /// <summary>The default title (the frontend's <c>DEFAULT_SITUATION_TITLE</c>; keep them equal).</summary>
    public const string Default = "Untitled Situation";

    private SituationTitle(string value)
    {
        Value = value;
        Normalized = Normalize(value);
    }

    /// <summary>The title as stored and shown.</summary>
    public string Value { get; }

    /// <summary>The form titles are compared in.</summary>
    public string Normalized { get; }

    /// <summary>Whether this is the default title (ignoring upper/lower case), without a number.</summary>
    public bool IsDefault => Normalized == Normalize(Default);

    /// <summary>Validates a title from a situation document.</summary>
    public static bool TryCreate(string? input, [NotNullWhen(true)] out SituationTitle? title, [NotNullWhen(false)] out string? error)
    {
        var trimmed = input?.Trim() ?? string.Empty;
        if (trimmed.Length > MaxLength)
        {
            title = null;
            error = $"expected at most {MaxLength} characters";
            return false;
        }

        error = null;
        title = new SituationTitle(trimmed.Length == 0 ? Default : trimmed);
        return true;
    }

    /// <summary>Restores a title that was validated before (e.g. loaded from the database).</summary>
    public static SituationTitle FromTrusted(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        return new SituationTitle(value);
    }

    /// <summary>The comparison form of <paramref name="text"/> (<see cref="UniqueNames.Normalize"/>).</summary>
    public static string Normalize(string text) => UniqueNames.Normalize(text);

    /// <summary>This title with the suffix <c> (n)</c>, e.g. <c>Powerplay (2)</c>.</summary>
    public SituationTitle WithNumber(int number)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(number, 2);
        return new SituationTitle($"{Value} ({number})");
    }

    /// <summary>
    /// This title if it is free, otherwise the first free one of <c>"{title} (2)"</c>,
    /// <c>"{title} (3)"</c>, … (arc42 ch. 8.15: imported situations, copies, default titles).
    /// </summary>
    /// <param name="taken">The normalized titles already used in the area.</param>
    public SituationTitle FirstFree(IReadOnlySet<string> taken)
    {
        ArgumentNullException.ThrowIfNull(taken);
        if (!taken.Contains(Normalized))
        {
            return this;
        }

        var number = 2;
        while (taken.Contains(WithNumber(number).Normalized))
        {
            number++;
        }

        return WithNumber(number);
    }

    /// <inheritdoc />
    public override string ToString() => Value;
}
