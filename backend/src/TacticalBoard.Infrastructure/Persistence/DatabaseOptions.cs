namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>
/// Database settings. The connection string comes from <c>ConnectionStrings__TacticalBoard</c>,
/// the rest from the <c>Database</c> section (e.g. <c>Database__MigrateOnStartup</c>).
/// </summary>
public sealed class DatabaseOptions
{
    /// <summary>The configuration section with the database settings.</summary>
    public const string SectionName = "Database";

    /// <summary>The name of the connection string (<c>ConnectionStrings:TacticalBoard</c>).</summary>
    public const string ConnectionStringName = "TacticalBoard";

    /// <summary>The Npgsql connection string.</summary>
    public string ConnectionString { get; set; } = string.Empty;

    /// <summary>Whether pending EF Core migrations are applied when the backend starts. Default: <c>true</c>.</summary>
    public bool MigrateOnStartup { get; set; } = true;
}
