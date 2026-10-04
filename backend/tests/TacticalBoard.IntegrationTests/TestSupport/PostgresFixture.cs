using Npgsql;
using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(TacticalBoard.IntegrationTests.TestSupport.PostgresFixture))]

namespace TacticalBoard.IntegrationTests.TestSupport;

/// <summary>
/// One PostgreSQL container for the whole test run (same major version as in compose.yaml).
/// Every test gets its own database in it, so tests stay independent.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    public const string Image = "postgres:18-alpine";

    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder(Image).Build();

    /// <summary>A connection string for a fresh, not yet existing database.</summary>
    public string NewDatabaseConnectionString() =>
        new NpgsqlConnectionStringBuilder(_container.GetConnectionString())
        {
            Database = "test_" + Guid.NewGuid().ToString("N"),
        }.ConnectionString;

    /// <summary>A connection string for the server's maintenance database (<c>postgres</c>).</summary>
    public string AdminConnectionString =>
        new NpgsqlConnectionStringBuilder(_container.GetConnectionString()) { Database = "postgres" }.ConnectionString;

    public ValueTask InitializeAsync() => new(_container.StartAsync());

    public ValueTask DisposeAsync() => _container.DisposeAsync();
}
