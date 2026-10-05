using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Teams;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.Teams.Endpoints;
using TacticalBoard.Teams.Infrastructure;
using TacticalBoard.Users;

namespace TacticalBoard.UnitTests.Teams;

public class TeamsModuleTests
{
    private static ServiceProvider Build()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:TacticalBoard"] = "Host=unused;Database=unused" })
            .Build();
        var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration);
        services.AddSharedKernelServices().AddPersistence("TacticalBoard.Api");
        new UsersModule().RegisterServices(services, configuration);
        new TeamsModule().RegisterServices(services, configuration);
        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }

    [Fact]
    public void Provides_the_services_repositories_and_the_authorization_per_request()
    {
        using var services = Build();
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;

        Assert.NotNull(provider.GetRequiredService<TeamService>());
        Assert.NotNull(provider.GetRequiredService<TeamMembershipService>());
        Assert.NotNull(provider.GetRequiredService<TeamJoinRequestService>());
        Assert.NotNull(provider.GetRequiredService<TeamDeletionService>());
        Assert.Same(provider.GetRequiredService<TeamLocks>(), provider.GetRequiredService<TeamLocks>());
        Assert.IsType<TeamAuthorization>(provider.GetRequiredService<ITeamAuthorization>());
        Assert.IsType<TeamDirectory>(provider.GetRequiredService<ITeamDirectory>());
        Assert.IsType<EfTeamRepository>(provider.GetRequiredService<ITeamRepository>());
        Assert.IsType<EfTeamMembershipRepository>(provider.GetRequiredService<ITeamMembershipRepository>());
        Assert.IsType<EfTeamJoinRequestRepository>(provider.GetRequiredService<ITeamJoinRequestRepository>());
        Assert.Empty(provider.GetServices<ITeamDeletionParticipant>());
        Assert.IsType<RandomTeamCodeGenerator>(provider.GetRequiredService<ITeamCodeGenerator>());
        Assert.IsType<SkiaLogoImageProcessor>(provider.GetRequiredService<ILogoImageProcessor>());
    }

    [Fact]
    public void Maps_teams_with_a_partial_unique_name_index_and_a_unique_code_index_over_all_teams()
    {
        using var services = Build();
        using var scope = services.CreateScope();
        var model = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>().Model;

        var teams = model.FindEntityType(typeof(Team))!;
        Assert.Equal("teams", teams.GetTableName());
        var name = teams.GetIndexes().Single(index => index.GetDatabaseName() == TeamConfiguration.NameIndexName);
        Assert.True(name.IsUnique);
        Assert.Equal("deleted_at IS NULL", name.GetFilter());
        Assert.Equal(["NormalizedName"], name.Properties.Select(property => property.Name));
        var code = teams.GetIndexes().Single(index => index.GetDatabaseName() == TeamConfiguration.CodeIndexName);
        Assert.True(code.IsUnique);
        Assert.Null(code.GetFilter());
        Assert.Equal(TeamName.MaxLength, teams.FindProperty(nameof(Team.Name))!.GetMaxLength());
        Assert.NotNull(teams.FindDeclaredQueryFilter(SoftDeleteQueryFilter.Name));

        var memberships = model.FindEntityType(typeof(TeamMembership))!;
        Assert.Equal("team_memberships", memberships.GetTableName());
        var teamUser = memberships.GetIndexes().Single(index => index.GetDatabaseName() == TeamMembershipConfiguration.TeamUserIndexName);
        Assert.True(teamUser.IsUnique);
        Assert.Equal("deleted_at IS NULL", teamUser.GetFilter());
        Assert.NotNull(memberships.FindDeclaredQueryFilter(SoftDeleteQueryFilter.Name));

        var requests = model.FindEntityType(typeof(TeamJoinRequest))!;
        Assert.Equal(TeamJoinRequestConfiguration.TableName, requests.GetTableName());
        var pending = requests.GetIndexes().Single(index => index.GetDatabaseName() == TeamJoinRequestConfiguration.PendingIndexName);
        Assert.True(pending.IsUnique);
        Assert.Equal("status = 'Pending' AND deleted_at IS NULL", pending.GetFilter());
        Assert.Equal(["TeamId", "UserId"], pending.Properties.Select(property => property.Name));
        Assert.NotNull(requests.FindDeclaredQueryFilter(SoftDeleteQueryFilter.Name));

        var logos = model.FindEntityType(typeof(TeamLogo))!;
        Assert.Equal(TeamLogoConfiguration.TableName, logos.GetTableName());
        Assert.Equal(["TeamId"], logos.FindPrimaryKey()!.Properties.Select(property => property.Name));
    }

    [Fact]
    public async Task Maps_the_team_endpoints_with_a_session_and_a_request_size_limit_for_uploads()
    {
        await using var app = WebApplication.CreateBuilder().Build();
        var api = app.MapGroup("/api");

        new TeamsModule().MapEndpoints(api);

        var endpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>().ToList();
        var routes = endpoints
            .Select(endpoint => $"{endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()!.HttpMethods.Single()} {endpoint.RoutePattern.RawText}")
            .Order()
            .ToList();
        Assert.Equal(
            [
                "DELETE /api/teams/{team}",
                "DELETE /api/teams/{team}/logo",
                "DELETE /api/teams/{team}/members/{userId:guid}",
                "DELETE /api/teams/{team}/members/me",
                "GET /api/me/teams/",
                "GET /api/teams/",
                "GET /api/teams/{team}",
                "GET /api/teams/{team}/join-requests",
                "GET /api/teams/{team}/logo",
                "GET /api/teams/{team}/members",
                "POST /api/teams/",
                "POST /api/teams/{team}/join-requests",
                "POST /api/teams/{team}/join-requests/{requestId:guid}/accept",
                "POST /api/teams/{team}/join-requests/{requestId:guid}/reject",
                "PUT /api/teams/{team}",
                "PUT /api/teams/{team}/logo",
                "PUT /api/teams/{team}/members/{userId:guid}/role",
            ],
            routes);
        Assert.All(endpoints, endpoint => Assert.NotNull(endpoint.Metadata.GetMetadata<Microsoft.AspNetCore.Authorization.IAuthorizeData>()));
        var uploads = endpoints.Where(endpoint => endpoint.Metadata.GetMetadata<IRequestSizeLimitMetadata>() is not null).ToList();
        Assert.Equal(["/api/teams/", "/api/teams/{team}/logo"], uploads.Select(endpoint => endpoint.RoutePattern.RawText).Order());
        Assert.Equal(2, uploads.Count);
        Assert.All(uploads, endpoint => Assert.Equal(TeamEndpoints.MaxUploadRequestBytes, endpoint.Metadata.GetMetadata<IRequestSizeLimitMetadata>()!.MaxRequestBodySize));
    }
}
