using Npgsql;

namespace TacticalBoard.IntegrationTests.TestSupport;

/// <summary>Small raw SQL helpers to look at the database independently of EF Core.</summary>
internal static class PostgresQueries
{
    public static async Task<bool> DatabaseExistsAsync(string adminConnectionString, string database, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(adminConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = @name)", connection);
        command.Parameters.AddWithValue("name", database);
        return (bool)(await command.ExecuteScalarAsync(cancellationToken))!;
    }

    public static async Task<List<string>> AppliedMigrationsAsync(string connectionString, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("""SELECT migration_id FROM "__EFMigrationsHistory" ORDER BY migration_id""", connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var migrations = new List<string>();
        while (await reader.ReadAsync(cancellationToken))
        {
            migrations.Add(reader.GetString(0));
        }

        return migrations;
    }

    public static async Task<List<string>> ColumnsAsync(string connectionString, string table, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(
            "SELECT column_name FROM information_schema.columns WHERE table_name = @table ORDER BY column_name", connection);
        command.Parameters.AddWithValue("table", table);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var columns = new List<string>();
        while (await reader.ReadAsync(cancellationToken))
        {
            columns.Add(reader.GetString(0));
        }

        return columns;
    }
}
