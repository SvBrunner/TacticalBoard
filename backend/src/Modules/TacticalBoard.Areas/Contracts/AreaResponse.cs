namespace TacticalBoard.Areas.Contracts;

/// <summary>
/// An area as the REST API shows it on folders and situations (arc42 ch. 8.15):
/// <c>{ "kind": "personal" | "team", "id": … }</c> — the id of the user (personal area) or team.
/// </summary>
/// <param name="Kind"><c>personal</c> or <c>team</c>.</param>
/// <param name="Id">The owner of the area.</param>
public sealed record AreaResponse(string Kind, Guid Id)
{
    /// <summary>The response for <paramref name="area"/>.</summary>
    public static AreaResponse From(AreaReference area)
    {
        ArgumentNullException.ThrowIfNull(area);
        var kind = area.Kind switch
        {
            AreaKind.Personal => "personal",
            AreaKind.Team => "team",
            _ => throw new ArgumentOutOfRangeException(nameof(area), area.Kind, "Unknown area kind."),
        };
        return new AreaResponse(kind, area.OwnerId);
    }
}
