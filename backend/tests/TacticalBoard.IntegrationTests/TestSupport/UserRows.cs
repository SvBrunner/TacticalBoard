using Npgsql;

namespace TacticalBoard.IntegrationTests.TestSupport;

/// <summary>Direct access to the <c>users</c> table, e.g. to block a user before the admin UI exists.</summary>
internal static class UserRows
{
    public static Task BlockAsync(string connectionString, string subject) =>
        ExecuteAsync(connectionString, "UPDATE users SET is_blocked = true WHERE subject = @subject", subject);

    public static Task DeleteAsync(string connectionString, string subject) =>
        ExecuteAsync(connectionString, "UPDATE users SET deleted_at = now() WHERE subject = @subject", subject);

    public static Task RevokeSystemAdministratorAsync(string connectionString, string subject) =>
        ExecuteAsync(connectionString, "UPDATE users SET is_system_administrator = false WHERE subject = @subject", subject);

    public static async Task<int> CountAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand("SELECT count(*) FROM users", connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken), System.Globalization.CultureInfo.InvariantCulture);
    }

    private static async Task ExecuteAsync(string connectionString, string sql, string subject)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("subject", subject);
        Assert.Equal(1, await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken));
    }
}
