namespace TacticalBoard.Areas.Contracts;

/// <summary>
/// Deletes the content of an area that is going away (arc42 ch. 5.2, 8.16): a deleted team's area
/// now, a deleted account's personal area later (roadmap Phase 2 step 10). Areas may not use Folders
/// or Situations (the arrows point to Areas), so it declares this contract and the modules that keep
/// content in areas implement it (dependency inversion): Folders soft-deletes the area's folders,
/// Situations its situations (roadmap Phase 2 step 8). Called inside the transaction of the deletion
/// that triggers it; throwing cancels that deletion.
/// </summary>
public interface IAreaContentDeletion
{
    /// <summary>Soft-deletes everything this module keeps in <paramref name="area"/>, stamped <paramref name="deletedAt"/>.</summary>
    Task DeleteContentAsync(AreaReference area, DateTimeOffset deletedAt, CancellationToken cancellationToken);
}
