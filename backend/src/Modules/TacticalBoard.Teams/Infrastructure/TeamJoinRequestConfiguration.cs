using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary>The <c>team_join_requests</c> table (arc42 ch. 8.17).</summary>
internal sealed class TeamJoinRequestConfiguration : IEntityTypeConfiguration<TeamJoinRequest>
{
    public const string TableName = "team_join_requests";

    /// <summary>
    /// At most one pending request per team and user: a unique index partial on pending, non-deleted
    /// rows (PostgreSQL syntax, kept inside the data-access layer, ADR-002); decided requests stay as
    /// history, so a user may ask again after a rejection. It also serves a team's pending list.
    /// </summary>
    public const string PendingIndexName = "ix_team_join_requests_pending";

    public void Configure(EntityTypeBuilder<TeamJoinRequest> builder)
    {
        builder.ToTable(TableName);
        builder.HasKey(request => request.Id);
        builder.Property(request => request.Id).ValueGeneratedNever();
        builder.Property(request => request.TeamId);
        builder.Property(request => request.UserId);
        builder.Property(request => request.RequestedAt);
        builder.Property(request => request.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(request => request.DecidedAt);
        builder.Property(request => request.DecidedBy);
        builder.Property(request => request.DeletedAt);
        builder.Ignore(request => request.IsPending);
        builder.Ignore(request => request.IsDeleted);
        builder.HasOne<Team>().WithMany().HasForeignKey(request => request.TeamId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(request => new { request.TeamId, request.UserId })
            .IsUnique()
            .HasFilter("status = 'Pending' AND deleted_at IS NULL")
            .HasDatabaseName(PendingIndexName);
    }
}
