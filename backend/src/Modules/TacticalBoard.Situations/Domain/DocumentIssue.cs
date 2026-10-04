using TacticalBoard.SharedKernel.Validation;

namespace TacticalBoard.Situations.Domain;

/// <summary>One problem of a situation document, e.g. <c>situation.frames[0].elements[2].x: expected finite number</c>.</summary>
/// <param name="Path">Where in the document, from its root (<c>(root)</c> for the document itself).</param>
/// <param name="Error">What is wrong: a stable code (e.g. <c>expected-finite-number</c>, arc42 ch. 8.2) and the English message.</param>
internal sealed record DocumentIssue(string Path, FieldError Error)
{
    /// <summary>What is wrong, in English (the same text as the frontend's validator).</summary>
    public string Message => Error.Message;

    /// <inheritdoc />
    public override string ToString() => $"{Path}: {Message}";
}
