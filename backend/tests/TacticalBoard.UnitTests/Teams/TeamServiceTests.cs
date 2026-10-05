using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamServiceTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");

    private readonly FakeUnitOfWork _transactions = new();
    private readonly InMemoryTeamRepository _repository;
    private readonly FakeCurrentUser _currentUser = new(Alice);
    private readonly SequenceTeamCodeGenerator _codes = new("AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD");
    private readonly FixedClock _clock = new(TestTeams.Now);
    private readonly SequenceIdGenerator _ids = new();

    public TeamServiceTests()
    {
        _repository = new InMemoryTeamRepository(_transactions);
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private TeamService Service =>
        new(_repository, _repository, new TeamAuthorization(_currentUser, _repository), _currentUser, _codes, _transactions, _ids, _clock);

    private Task<TeamView> CreateAsync(string name, TeamLogoImage? logo = null) => Service.CreateAsync(TestTeams.Name(name), logo, Cancellation);

    private static TeamKey Code(string? code) => TeamKey.OfCode(TeamCode.Parse(code!));

    [Fact]
    public async Task Creates_a_team_with_a_new_code_and_makes_its_creator_Admin()
    {
        var view = await CreateAsync(" Lions ");

        Assert.Equal(("AAAAAA", "Lions", null, TestTeams.Now, TeamRole.Admin), (view.Code, view.Name, view.LogoHash, view.CreatedAt, view.Role));
        var team = Assert.Single(_repository.Teams);
        Assert.Equal((view.Id, Alice), (team.Id, team.CreatedBy));
        var membership = Assert.Single(_repository.Memberships);
        Assert.Equal((team.Id, Alice, TeamRole.Admin), (membership.TeamId, membership.UserId, membership.Role));
        Assert.Empty(_repository.Logos);
    }

    [Fact]
    public async Task Creates_a_team_with_its_logo_at_once()
    {
        var logo = TestTeams.Logo();

        var view = await CreateAsync("Lions", logo);

        Assert.Equal(logo.Hash, view.LogoHash);
        var stored = Assert.Single(_repository.Logos).Value;
        Assert.Equal((view.Id, logo.Hash, Alice), (stored.TeamId, stored.Hash, stored.UpdatedBy));
        Assert.Equal(1, _repository.SaveCount);
    }

    [Fact]
    public async Task A_taken_name_is_rejected_ignoring_case_and_whitespace()
    {
        await CreateAsync("Lions");

        var error = await Assert.ThrowsAsync<DuplicateTeamNameException>(() => CreateAsync("  LIONS"));

        Assert.Equal("LIONS", error.Details["existingName"]);
        Assert.Single(_repository.Teams);
    }

    [Fact]
    public async Task A_name_taken_by_a_parallel_save_is_a_duplicate()
    {
        _repository.NameTakenInParallel = true;

        await Assert.ThrowsAsync<DuplicateTeamNameException>(() => CreateAsync("Lions"));
        Assert.Empty(_repository.Teams);
    }

    [Fact]
    public async Task The_name_of_a_deleted_team_is_free_again()
    {
        await CreateAsync("Lions");
        _repository.Teams[0].MarkDeleted(TestTeams.Now);

        var view = await CreateAsync("Lions");

        Assert.Equal("BBBBBB", view.Code);
    }

    [Fact]
    public async Task A_taken_code_also_of_a_deleted_team_is_skipped()
    {
        await CreateAsync("Lions");
        _repository.Teams[0].MarkDeleted(TestTeams.Now);
        _codes.Add("AAAAAA");
        var codes = new SequenceTeamCodeGenerator("AAAAAA", "EEEEEE");
        var service = new TeamService(_repository, _repository, new TeamAuthorization(_currentUser, _repository), _currentUser, codes, _transactions, _ids, _clock);

        var view = await service.CreateAsync(TestTeams.Name("Tigers"), null, Cancellation);

        Assert.Equal("EEEEEE", view.Code);
        Assert.Equal(2, codes.Generated);
    }

    [Fact]
    public async Task A_code_taken_by_a_parallel_save_is_retried_with_a_new_code()
    {
        _repository.CodesTakenInParallel = 2;

        var view = await CreateAsync("Lions");

        Assert.Equal("CCCCCC", view.Code);
        Assert.Single(_repository.Teams);
        Assert.Single(_repository.Memberships);
    }

    [Fact]
    public async Task Gives_up_after_ten_taken_codes()
    {
        _codes.Add(Enumerable.Range(0, 10).Select(i => $"ZZZZZ{i}").ToArray());
        _repository.CodesTakenInParallel = TeamService.MaxCodeAttempts;

        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateAsync("Lions"));

        Assert.Equal(TeamService.MaxCodeAttempts, _codes.Generated);
        Assert.Empty(_repository.Teams);
    }

    [Fact]
    public async Task Search_passes_the_normalized_text_and_the_page_and_returns_the_total()
    {
        await CreateAsync("Lions");
        await CreateAsync("Tigers");
        await CreateAsync("Lionesses");
        TeamSearch.TryCreate(" lion ", 1, 1, out var search, out _);

        var result = await Service.SearchAsync(search!, Cancellation);

        Assert.Equal(("LION", "LION", 1, 1), _repository.Searches.Single());
        Assert.Equal((2, 1, 1), (result.Total, result.Offset, result.Limit));
        Assert.Equal(["Lions"], result.Teams.Select(team => team.Name));
    }

    [Fact]
    public async Task Search_finds_a_team_by_its_code()
    {
        await CreateAsync("Lions");
        await CreateAsync("Tigers");
        TeamSearch.TryCreate("bbb", null, null, out var search, out _);

        var result = await Service.SearchAsync(search!, Cancellation);

        var team = Assert.Single(result.Teams);
        Assert.Equal(("Tigers", "BBBBBB"), (team.Name, team.Code));
        _currentUser.UserId = Bob;
        Assert.Null(Assert.Single((await Service.SearchAsync(search!, Cancellation)).Teams).Code);
    }

    [Fact]
    public async Task Lists_the_current_users_teams_by_name_with_their_roles()
    {
        await CreateAsync("tigers");
        await CreateAsync("Lions");
        _currentUser.UserId = Bob;
        var bobs = await CreateAsync("Bears");
        _repository.AddMember(_repository.Teams[0], Bob, TeamRole.Reader);

        var mine = await Service.ListMineAsync(Cancellation);

        Assert.Equal([("Bears", TeamRole.Admin), ("tigers", TeamRole.Reader)], mine.Select(entry => (entry.Team.Name, entry.Role)));
        Assert.Equal(bobs.Code, mine[0].Team.Code);
    }

    [Fact]
    public async Task Gets_a_team_with_the_role_of_the_current_user_or_none()
    {
        var created = await CreateAsync("Lions");

        Assert.Equal(TeamRole.Admin, (await Service.GetAsync(Code(created.Code), Cancellation)).Role);
        _currentUser.UserId = Bob;
        var asStranger = await Service.GetAsync(Code(created.Code), Cancellation);
        Assert.Equal((created.Id, "Lions", null), (asStranger.Id, asStranger.Name, asStranger.Role));
    }

    [Fact]
    public async Task Members_see_the_code_and_non_members_only_name_and_logo()
    {
        var created = await CreateAsync("Lions", TestTeams.Logo());
        _repository.AddMember(_repository.Teams[0], Bob, TeamRole.Reader);
        _currentUser.UserId = Bob;
        Assert.Equal("AAAAAA", (await Service.GetAsync(Code(created.Code), Cancellation)).Code);

        _currentUser.UserId = Guid.NewGuid();
        var stranger = await Service.GetAsync(TeamKey.OfId(created.Id), Cancellation);

        Assert.Equal((null, "Lions", created.LogoHash, null), (stranger.Code, stranger.Name, stranger.LogoHash, stranger.Role));
    }

    [Fact]
    public async Task Gets_a_team_by_its_id_too()
    {
        var created = await CreateAsync("Lions");

        var view = await Service.GetAsync(TeamKey.OfId(created.Id), Cancellation);

        Assert.Equal(("AAAAAA", TeamRole.Admin), (view.Code, view.Role));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.GetAsync(TeamKey.OfId(Guid.NewGuid()), Cancellation));
    }

    [Fact]
    public async Task A_non_member_sees_whether_their_join_request_is_pending_and_an_Admin_how_many_wait()
    {
        var created = await CreateAsync("Lions");
        var team = _repository.Teams[0];
        Assert.Equal((false, 0), ((await Service.GetAsync(Code(created.Code), Cancellation)).JoinRequestPending, (await Service.GetAsync(Code(created.Code), Cancellation)).PendingJoinRequests));
        _repository.AddJoinRequest(team, Bob);
        _repository.AddJoinRequest(team, Guid.NewGuid());

        Assert.Equal(2, (await Service.GetAsync(Code(created.Code), Cancellation)).PendingJoinRequests);
        _currentUser.UserId = Bob;
        var asRequester = await Service.GetAsync(Code(created.Code), Cancellation);
        Assert.Equal((true, (int?)null, (string?)null), (asRequester.JoinRequestPending, asRequester.PendingJoinRequests, asRequester.Code));
        _currentUser.UserId = Guid.NewGuid();
        Assert.False((await Service.GetAsync(Code(created.Code), Cancellation)).JoinRequestPending);
    }

    [Theory]
    [InlineData(TeamRole.Editor)]
    [InlineData(TeamRole.Reader)]
    public async Task Editors_and_Readers_get_no_count_of_join_requests(TeamRole role)
    {
        var created = await CreateAsync("Lions");
        _repository.AddMember(_repository.Teams[0], Bob, role);
        _repository.AddJoinRequest(_repository.Teams[0], Guid.NewGuid());
        _currentUser.UserId = Bob;

        var view = await Service.GetAsync(Code(created.Code), Cancellation);

        Assert.Equal((role, (int?)null, false), (view.Role!.Value, view.PendingJoinRequests, view.JoinRequestPending));
    }

    [Fact]
    public async Task Search_shows_the_code_only_of_the_users_own_teams()
    {
        await CreateAsync("Lions");
        _currentUser.UserId = Bob;
        await CreateAsync("Tigers");
        TeamSearch.TryCreate(null, null, null, out var search, out _);

        var result = await Service.SearchAsync(search!, Cancellation);

        Assert.Equal([("Lions", null), ("Tigers", "BBBBBB")], result.Teams.Select(team => (team.Name, team.Code)));
    }

    [Fact]
    public async Task Lists_the_number_of_pending_join_requests_for_the_teams_the_user_is_Admin_of()
    {
        await CreateAsync("Lions");
        _currentUser.UserId = Bob;
        await CreateAsync("Tigers");
        _repository.AddMember(_repository.Teams[0], Bob, TeamRole.Editor);
        _repository.AddJoinRequest(_repository.Teams[0], Guid.NewGuid());
        _repository.AddJoinRequest(_repository.Teams[1], Guid.NewGuid());
        _repository.AddJoinRequest(_repository.Teams[1], Guid.NewGuid());

        var mine = await Service.ListMineAsync(Cancellation);

        Assert.Equal([("Lions", TeamRole.Editor, (int?)null), ("Tigers", TeamRole.Admin, 2)], mine.Select(entry => (entry.Team.Name, entry.Role, entry.PendingJoinRequests)));
    }

    [Fact]
    public async Task An_unknown_or_deleted_team_is_not_found()
    {
        var created = await CreateAsync("Lions");
        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.GetAsync(Code("ZZZZZZ"), Cancellation));

        _repository.Teams[0].MarkDeleted(TestTeams.Now);

        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.GetAsync(Code(created.Code), Cancellation));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.RenameAsync(Code(created.Code), TestTeams.Name("X"), Cancellation));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.GetLogoAsync(Code(created.Code), Cancellation));
    }

    [Fact]
    public async Task An_Admin_renames_the_team()
    {
        var created = await CreateAsync("Lions");
        _clock.UtcNow = TestTeams.Now.AddHours(1);

        var renamed = await Service.RenameAsync(Code(created.Code), TestTeams.Name(" Tigers "), Cancellation);

        Assert.Equal(("Tigers", created.Code, TeamRole.Admin), (renamed.Name, renamed.Code, renamed.Role));
        Assert.Equal((_clock.UtcNow, Alice), (_repository.Teams[0].UpdatedAt, _repository.Teams[0].UpdatedBy));
    }

    [Fact]
    public async Task Renaming_to_its_own_name_in_another_case_is_no_conflict()
    {
        var created = await CreateAsync("Lions");

        var renamed = await Service.RenameAsync(Code(created.Code), TestTeams.Name("LIONS"), Cancellation);

        Assert.Equal("LIONS", renamed.Name);
    }

    [Fact]
    public async Task Renaming_to_a_taken_name_is_a_duplicate_also_when_taken_in_parallel()
    {
        await CreateAsync("Lions");
        var tigers = await CreateAsync("Tigers");

        await Assert.ThrowsAsync<DuplicateTeamNameException>(() => Service.RenameAsync(Code(tigers.Code), TestTeams.Name("lions"), Cancellation));
        _repository.NameTakenInParallel = true;
        await Assert.ThrowsAsync<DuplicateTeamNameException>(() => Service.RenameAsync(Code(tigers.Code), TestTeams.Name("Bears"), Cancellation));
    }

    [Theory]
    [InlineData(TeamRole.Editor)]
    [InlineData(TeamRole.Reader)]
    [InlineData(null)]
    public async Task Only_Admins_change_name_and_logo(TeamRole? role)
    {
        var created = await CreateAsync("Lions");
        _repository.AddMember(_repository.Teams[0], Bob, role ?? TeamRole.Reader);
        if (role is null)
        {
            _repository.Memberships.RemoveAt(1);
        }

        _currentUser.UserId = Bob;
        var code = Code(created.Code);

        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.RenameAsync(code, TestTeams.Name("Tigers"), Cancellation));
        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.SetLogoAsync(code, TestTeams.Logo(), Cancellation));
        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.RemoveLogoAsync(code, Cancellation));
        Assert.Equal("Lions", _repository.Teams[0].Name);
        Assert.Empty(_repository.LogoWrites);
    }

    [Fact]
    public async Task An_Admin_sets_replaces_and_removes_the_logo_in_one_transaction_each()
    {
        var created = await CreateAsync("Lions");
        var code = Code(created.Code);
        var first = TestTeams.Logo(1);
        var second = TestTeams.Logo(2);

        var withFirst = await Service.SetLogoAsync(code, first, Cancellation);
        Assert.Equal(first.Hash, withFirst.LogoHash);
        var withSecond = await Service.SetLogoAsync(code, second, Cancellation);
        Assert.Equal(second.Hash, withSecond.LogoHash);
        Assert.Equal(second.Hash, _repository.Logos[created.Id].Hash);
        Assert.Equal(second.Hash, (await Service.GetLogoAsync(code, Cancellation)).Hash);

        var without = await Service.RemoveLogoAsync(code, Cancellation);
        Assert.Null(without.LogoHash);
        Assert.Empty(_repository.Logos);
        Assert.Null(_repository.Teams[0].LogoHash);

        Assert.Equal(3, _transactions.Transactions);
        Assert.All(_repository.LogoWrites, write => Assert.True(write.InTransaction));
    }

    [Fact]
    public async Task Gets_the_logo_or_says_there_is_none()
    {
        var logo = TestTeams.Logo();
        var withLogo = await CreateAsync("Lions", logo);
        var without = await CreateAsync("Tigers");

        var stored = await Service.GetLogoAsync(Code(withLogo.Code), Cancellation);

        Assert.Equal((logo.Hash, "image/png"), (stored.Hash, stored.ContentType));
        Assert.Equal(logo.Content.ToArray(), stored.Content.ToArray());
        await Assert.ThrowsAsync<TeamLogoNotFoundException>(() => Service.GetLogoAsync(Code(without.Code), Cancellation));
    }

    [Fact]
    public async Task Everyone_logged_in_may_read_the_logo()
    {
        var created = await CreateAsync("Lions", TestTeams.Logo());
        _currentUser.UserId = Bob;

        Assert.NotNull(await Service.GetLogoAsync(Code(created.Code), Cancellation));
    }
}
