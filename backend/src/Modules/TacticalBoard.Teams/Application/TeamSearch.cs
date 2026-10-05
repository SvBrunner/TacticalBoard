using System.Diagnostics.CodeAnalysis;
using TacticalBoard.SharedKernel.Text;
using TacticalBoard.SharedKernel.Validation;

namespace TacticalBoard.Teams.Application;

/// <summary>
/// A query of the team overview (arc42 ch. 8.17): an optional search text, matched as a part of the
/// name (ignoring case, like names are compared) or of the code (ignoring case), and a page
/// (<see cref="Offset"/>, <see cref="Limit"/>). The page size is a technical limit.
/// </summary>
internal sealed record TeamSearch
{
    /// <summary>The page size when none is asked for.</summary>
    public const int DefaultLimit = 50;

    /// <summary>The largest page size.</summary>
    public const int MaxLimit = 100;

    /// <summary>The longest search text (longer than any team name).</summary>
    public const int MaxTextLength = 100;

    /// <summary>The validation error key of the search text.</summary>
    public const string TextField = "search";

    public const string OffsetField = "offset";

    public const string LimitField = "limit";

    private TeamSearch(string? text, int offset, int limit)
    {
        Text = text;
        Offset = offset;
        Limit = limit;
    }

    /// <summary>The trimmed search text, or <c>null</c> to list all teams.</summary>
    public string? Text { get; }

    public int Offset { get; }

    public int Limit { get; }

    /// <summary>The text in the form team names are compared in (<see cref="UniqueNames.Normalize"/>).</summary>
    public string? NameFragment => Text is null ? null : UniqueNames.Normalize(Text);

    /// <summary>The text in the form codes are stored in (upper case).</summary>
    public string? CodeFragment => Text?.ToUpperInvariant();

    /// <summary>All teams, first page.</summary>
    public static TeamSearch All { get; } = new(null, 0, DefaultLimit);

    /// <summary>Validates the query parameters; a blank text lists all teams.</summary>
    public static bool TryCreate(string? text, int? offset, int? limit, [NotNullWhen(true)] out TeamSearch? search, [NotNullWhen(false)] out FieldErrors? errors)
    {
        var trimmed = text?.Trim() ?? string.Empty;
        var problems = new FieldErrors();
        if (trimmed.Length > MaxTextLength)
        {
            problems.Add(TextField, FieldError.TooLong(MaxTextLength));
        }

        if (offset is < 0)
        {
            problems.Add(OffsetField, FieldError.Of("invalid-value", "must not be negative"));
        }

        if (limit is < 1 or > MaxLimit)
        {
            problems.Add(LimitField, FieldError.Of("invalid-value", $"must be between 1 and {MaxLimit}"));
        }

        search = problems.Any ? null : new TeamSearch(trimmed.Length == 0 ? null : trimmed, offset ?? 0, limit ?? DefaultLimit);
        errors = problems.Any ? problems : null;
        return search is not null;
    }
}
