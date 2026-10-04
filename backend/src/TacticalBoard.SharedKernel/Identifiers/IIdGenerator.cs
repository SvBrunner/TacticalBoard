namespace TacticalBoard.SharedKernel.Identifiers;

/// <summary>Creates identifiers for new entities.</summary>
public interface IIdGenerator
{
    /// <summary>A new, globally unique identifier.</summary>
    Guid NewId();
}
