using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary>The <c>team_logos</c> table: one processed logo (PNG bytes) per team that has one (arc42 ch. 8.17).</summary>
internal sealed class TeamLogoConfiguration : IEntityTypeConfiguration<TeamLogo>
{
    public const string TableName = "team_logos";

    public void Configure(EntityTypeBuilder<TeamLogo> builder)
    {
        builder.ToTable(TableName);
        builder.HasKey(logo => logo.TeamId);
        builder.Property(logo => logo.TeamId).ValueGeneratedNever();
        builder.Property(logo => logo.Content).IsRequired();
        builder.Property(logo => logo.ContentType).HasMaxLength(50).IsRequired();
        builder.Property(logo => logo.Hash).HasMaxLength(32).IsRequired();
        builder.Property(logo => logo.UpdatedAt);
        builder.Property(logo => logo.UpdatedBy);
        builder.HasOne<Team>().WithOne().HasForeignKey<TeamLogo>(logo => logo.TeamId).OnDelete(DeleteBehavior.Restrict);
    }
}
