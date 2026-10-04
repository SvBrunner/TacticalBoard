using TacticalBoard.Areas.Application;
using TacticalBoard.Users.Contracts;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Areas;

public class ActorDirectoryTests
{
    private sealed class FixedUserDirectory(Dictionary<Guid, string> names) : IUserDirectory
    {
        public List<IReadOnlyCollection<Guid>> Queries { get; } = [];

        public Task<IReadOnlyDictionary<Guid, string>> FindDisplayNamesAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
        {
            Queries.Add(userIds);
            IReadOnlyDictionary<Guid, string> found = names.Where(entry => userIds.Contains(entry.Key)).ToDictionary();
            return Task.FromResult(found);
        }
    }

    [Fact]
    public void The_current_user_is_the_sessions_user()
    {
        var id = Guid.NewGuid();

        Assert.Equal(id, new ActorDirectory(new FakeCurrentUser(id), new FixedUserDirectory([])).CurrentUserId);
        Assert.Throws<InvalidOperationException>(() => new ActorDirectory(new FakeCurrentUser(null), new FixedUserDirectory([])).CurrentUserId);
    }

    [Fact]
    public async Task Asks_the_user_directory_for_display_names()
    {
        var alice = Guid.NewGuid();
        var users = new FixedUserDirectory(new() { [alice] = "Alice" });

        var names = await new ActorDirectory(new FakeCurrentUser(alice), users)
            .FindDisplayNamesAsync([alice, Guid.NewGuid()], TestContext.Current.CancellationToken);

        Assert.Equal("Alice", Assert.Single(names).Value);
        Assert.Single(users.Queries);
    }
}
