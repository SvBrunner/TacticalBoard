using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary>The <c>teams</c> table (arc42 ch. 8.17).</summary>
internal sealed class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    /// <summary>
    /// Names are unique among non-deleted teams: a unique index on the normalized name, partial on
    /// <c>deleted_at IS NULL</c> (PostgreSQL syntax, kept inside the data-access layer, ADR-002).
    /// It also serves the overview's order.
    /// </summary>
    public const string NameIndexName = "ix_teams_name";

    /// <summary>Codes are unique among all teams, deleted ones included, so a code never points to another team.</summary>
    public const string CodeIndexName = "ix_teams_code";

    public void Configure(EntityTypeBuilder<Team> builder)
    {
        builder.ToTable("teams");
        builder.HasKey(team => team.Id);
        builder.Property(team => team.Id).ValueGeneratedNever();
        builder.Property(team => team.Name).HasMaxLength(TeamName.MaxLength).IsRequired();
        builder.Property(team => team.NormalizedName).IsRequired();
        builder.Property(team => team.Code).HasMaxLength(TeamCode.Length).IsFixedLength().IsRequired();
        builder.Property(team => team.LogoHash).HasMaxLength(32);
        builder.Property(team => team.CreatedAt);
        builder.Property(team => team.CreatedBy);
        builder.Property(team => team.UpdatedAt);
        builder.Property(team => team.UpdatedBy);
        builder.Property(team => team.DeletedAt);
        builder.Ignore(team => team.HasLogo);
        builder.Ignore(team => team.IsDeleted);
        builder.HasIndex(team => team.NormalizedName)
            .IsUnique()
            .HasFilter("deleted_at IS NULL")
            .HasDatabaseName(NameIndexName);
        builder.HasIndex(team => team.Code)
            .IsUnique()
            .HasDatabaseName(CodeIndexName);
    }
}
