using TacticalBoard.Users.Application;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Users;

public class UserDirectoryTests
{
    private readonly InMemoryUserRepository _repository = new();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Returns_the_display_names_of_existing_users()
    {
        var alice = TestUsers.Create("alice", "Alice");
        var bob = TestUsers.Create("bob", "Bob");
        _repository.Users.AddRange([alice, bob]);

        var names = await new UserDirectory(_repository).FindDisplayNamesAsync([alice.Id, bob.Id, alice.Id], Cancellation);

        Assert.Equal(new Dictionary<Guid, string> { [alice.Id] = "Alice", [bob.Id] = "Bob" }, names);
    }

    [Fact]
    public async Task Leaves_out_deleted_and_unknown_users()
    {
        var alice = TestUsers.Create("alice", "Alice");
        var gone = TestUsers.Create("gone", "Gone");
        gone.MarkDeleted(DateTimeOffset.UnixEpoch);
        _repository.Users.AddRange([alice, gone]);

        var names = await new UserDirectory(_repository).FindDisplayNamesAsync([alice.Id, gone.Id, Guid.NewGuid()], Cancellation);

        Assert.Equal([alice.Id], names.Keys);
    }

    [Fact]
    public async Task Does_not_query_for_no_users()
    {
        var names = await new UserDirectory(_repository).FindDisplayNamesAsync([], Cancellation);

        Assert.Empty(names);
        Assert.Equal(0, _repository.DisplayNameQueries);
    }

    [Fact]
    public async Task Rejects_a_missing_list() =>
        await Assert.ThrowsAsync<ArgumentNullException>(() => new UserDirectory(_repository).FindDisplayNamesAsync(null!, Cancellation));
}
