namespace TacticalBoard.Situations.Domain;

/// <summary>One problem of a situation document, e.g. <c>situation.frames[0].elements[2].x: expected finite number</c>.</summary>
/// <param name="Path">Where in the document, from its root (<c>(root)</c> for the document itself).</param>
/// <param name="Message">What is wrong.</param>
internal sealed record DocumentIssue(string Path, string Message)
{
    /// <inheritdoc />
    public override string ToString() => $"{Path}: {Message}";
}
