using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.SharedKernel.Validation;

/// <summary>
/// One validation problem of a request field (arc42 ch. 8.2): a stable, kebab-case
/// <see cref="Code"/> the client words in its own language (ch. 8.18), the code's
/// <see cref="Values"/> (e.g. <c>maxLength</c>), and an English <see cref="Message"/> for logs and
/// API consumers.
/// </summary>
public sealed record FieldError
{
    private FieldError(string code, string message, IReadOnlyDictionary<string, object> values)
    {
        Code = code;
        Message = message;
        Values = values;
    }

    /// <summary>Stable identifier of the problem, e.g. <c>too-long</c>.</summary>
    public string Code { get; }

    /// <summary>The problem in English, e.g. <c>must be at most 100 characters long</c>.</summary>
    public string Message { get; }

    /// <summary>The code's values with camelCase names, e.g. <c>maxLength: 100</c>; empty for most codes.</summary>
    public IReadOnlyDictionary<string, object> Values { get; }

    /// <summary>A problem with a code and its English message.</summary>
    /// <param name="code">The stable code (kebab-case).</param>
    /// <param name="message">The English message.</param>
    /// <param name="values">The code's values (camelCase name and value), if any.</param>
    public static FieldError Of(string code, string message, params (string Name, object Value)[] values)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(message);
        ArgumentNullException.ThrowIfNull(values);
        if (!ErrorCode.IsValid(code))
        {
            throw new ArgumentException($"Error code '{code}' must be kebab-case (a-z, 0-9, '-').", nameof(code));
        }

        return new FieldError(code, message, values.ToDictionary(value => value.Name, value => value.Value, StringComparer.Ordinal));
    }

    /// <summary>The field is empty: code <c>required</c>.</summary>
    public static FieldError Required(string message = "must not be empty") => Of("required", message);

    /// <summary>The field is longer than <paramref name="maxLength"/>: code <c>too-long</c> with <c>maxLength</c>.</summary>
    public static FieldError TooLong(int maxLength, string? message = null) =>
        Of("too-long", message ?? $"must be at most {maxLength} characters long", ("maxLength", maxLength));

    /// <summary>The field contains control characters: code <c>control-characters</c>.</summary>
    public static FieldError ControlCharacters(string message = "must not contain control characters") => Of("control-characters", message);

    /// <summary>The code and its values as one object, as the API sends it: <c>{ "code": "too-long", "maxLength": 100 }</c>.</summary>
    public IReadOnlyDictionary<string, object> ToCodeObject()
    {
        var result = new Dictionary<string, object>(StringComparer.Ordinal) { ["code"] = Code };
        foreach (var (name, value) in Values)
        {
            result[name] = value;
        }

        return result;
    }

    /// <inheritdoc />
    public override string ToString() => Message;
}
