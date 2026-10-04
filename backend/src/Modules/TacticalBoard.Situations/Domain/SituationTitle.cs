using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text.RegularExpressions;
using TacticalBoard.SharedKernel.Text;
using TacticalBoard.SharedKernel.Validation;

namespace TacticalBoard.Situations.Domain;

/// <summary>
/// A saved situation's title (arc42 ch. 8.15): trimmed; a blank title becomes the
/// <see cref="Default"/> title; at most <see cref="MaxLength"/> characters. Titles are unique
/// within an area, compared through <see cref="Normalized"/> (trimmed, Unicode NFC, upper case
/// invariant), i.e. ignoring surrounding whitespace and upper/lower case.
/// </summary>
internal sealed partial record SituationTitle
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
    public static bool TryCreate(string? input, [NotNullWhen(true)] out SituationTitle? title, [NotNullWhen(false)] out FieldError? error)
    {
        var trimmed = input?.Trim() ?? string.Empty;
        if (trimmed.Length > MaxLength)
        {
            title = null;
            error = FieldError.TooLong(MaxLength, $"expected at most {MaxLength} characters");
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
    /// The title numbers are added to, and the first number to try (arc42 ch. 8.15): a title that
    /// already ends with <c>" (n)"</c> is numbered on from <c>n + 1</c> on its base
    /// (<c>"Powerplay (2)"</c> → <c>"Powerplay"</c>, 3); any other title from 2 on itself.
    /// </summary>
    public (SituationTitle Base, int FirstNumber) NumberingStart
    {
        get
        {
            var match = NumberSuffix().Match(Value);
            if (match.Success && int.TryParse(match.Groups["number"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var number) && number < int.MaxValue)
            {
                return (new SituationTitle(match.Groups["base"].Value), Math.Max(number + 1, 2));
            }

            return (this, 2);
        }
    }

    /// <summary>
    /// This title if it is free, otherwise the first free numbered one (arc42 ch. 8.15: imported
    /// situations, copies, default titles): <c>"{title} (2)"</c>, <c>"{title} (3)"</c>, …; a title
    /// that already ends with <c>" (n)"</c> gets the next number instead of a second suffix
    /// (<c>"Powerplay (2)"</c> → <c>"Powerplay (3)"</c> or the next free one after it).
    /// </summary>
    /// <param name="taken">The normalized titles already used in the area (those starting with <see cref="NumberingStart"/>'s base).</param>
    public SituationTitle FirstFree(IReadOnlySet<string> taken)
    {
        ArgumentNullException.ThrowIfNull(taken);
        if (!taken.Contains(Normalized))
        {
            return this;
        }

        var (numberedBase, number) = NumberingStart;
        while (taken.Contains(numberedBase.WithNumber(number).Normalized))
        {
            number++;
        }

        return numberedBase.WithNumber(number);
    }

    [GeneratedRegex(@"^(?<base>.*\S) \((?<number>[1-9][0-9]{0,8})\)$", RegexOptions.CultureInvariant | RegexOptions.Singleline)]
    private static partial Regex NumberSuffix();

    /// <inheritdoc />
    public override string ToString() => Value;
}
