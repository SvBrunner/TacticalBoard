using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary>The <c>team_memberships</c> table (arc42 ch. 8.1, 8.17).</summary>
internal sealed class TeamMembershipConfiguration : IEntityTypeConfiguration<TeamMembership>
{
    /// <summary>At most one non-deleted membership per team and user (partial unique index).</summary>
    public const string TeamUserIndexName = "ix_team_memberships_team_user";

    /// <summary>For "the teams of a user" (the start page).</summary>
    public const string UserIndexName = "ix_team_memberships_user";

    public void Configure(EntityTypeBuilder<TeamMembership> builder)
    {
        builder.ToTable("team_memberships");
        builder.HasKey(membership => membership.Id);
        builder.Property(membership => membership.Id).ValueGeneratedNever();
        builder.Property(membership => membership.TeamId);
        builder.Property(membership => membership.UserId);
        builder.Property(membership => membership.Role).HasConversion<string>().HasMaxLength(20);
        builder.Property(membership => membership.JoinedAt);
        builder.Property(membership => membership.DeletedAt);
        builder.Ignore(membership => membership.IsDeleted);
        builder.HasOne<Team>().WithMany().HasForeignKey(membership => membership.TeamId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(membership => new { membership.TeamId, membership.UserId })
            .IsUnique()
            .HasFilter("deleted_at IS NULL")
            .HasDatabaseName(TeamUserIndexName);
        builder.HasIndex(membership => membership.UserId)
            .HasFilter("deleted_at IS NULL")
            .HasDatabaseName(UserIndexName);
    }
}
