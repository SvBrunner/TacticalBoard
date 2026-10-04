namespace TacticalBoard.SharedKernel.Validation;

/// <summary>
/// The validation problems of a request, per field, in the order they were found. The API sends
/// them twice in a <c>validation-failed</c> problem (arc42 ch. 8.2): as English messages in
/// <c>errors</c> (<see cref="Messages"/>, the ASP.NET Core standard) and as stable codes in the
/// extension member <c>fieldErrors</c> (<see cref="Codes"/>), with the same keys and order.
/// </summary>
public sealed class FieldErrors
{
    /// <summary>The name of the Problem Details extension member that carries the codes.</summary>
    public const string ExtensionName = "fieldErrors";

    private readonly Dictionary<string, List<FieldError>> _byField = new(StringComparer.Ordinal);

    /// <summary>Whether any problem was added.</summary>
    public bool Any => _byField.Count > 0;

    /// <summary>Adds a problem of <paramref name="field"/>.</summary>
    public FieldErrors Add(string field, FieldError error)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(field);
        ArgumentNullException.ThrowIfNull(error);
        if (!_byField.TryGetValue(field, out var errors))
        {
            errors = [];
            _byField[field] = errors;
        }

        errors.Add(error);
        return this;
    }

    /// <summary>The problems of <paramref name="field"/> (empty if none).</summary>
    public IReadOnlyList<FieldError> For(string field) =>
        _byField.TryGetValue(field, out var errors) ? errors : [];

    /// <summary>The English messages per field (the Problem Details <c>errors</c> member).</summary>
    public IDictionary<string, string[]> Messages() =>
        _byField.ToDictionary(pair => pair.Key, pair => pair.Value.Select(error => error.Message).ToArray(), StringComparer.Ordinal);

    /// <summary>The codes per field (the extension member <c>fieldErrors</c>).</summary>
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, object>[]> Codes() =>
        _byField.ToDictionary(pair => pair.Key, pair => pair.Value.Select(error => error.ToCodeObject()).ToArray(), StringComparer.Ordinal);

    /// <summary>The extension members of the problem: <c>{ "fieldErrors": … }</c>.</summary>
    public IDictionary<string, object?> Extensions() =>
        new Dictionary<string, object?>(StringComparer.Ordinal) { [ExtensionName] = Codes() };
}
