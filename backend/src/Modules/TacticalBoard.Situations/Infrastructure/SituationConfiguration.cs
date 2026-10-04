using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.Situations.Infrastructure;

/// <summary>The <c>situations</c> table: the metadata of every saved situation (ADR-009).</summary>
internal sealed class SituationConfiguration : IEntityTypeConfiguration<Situation>
{
    /// <summary>
    /// Titles are unique per area among non-deleted situations (arc42 ch. 8.15): a unique index on
    /// the normalized title, partial on <c>deleted_at IS NULL</c> (PostgreSQL syntax, kept inside
    /// the data-access layer, ADR-002). It also serves listing an area's situations.
    /// </summary>
    public const string TitleIndexName = "ix_situations_area_title";

    /// <summary>Lists a folder's situations and tells whether a folder is empty (ch. 8.15), among non-deleted situations.</summary>
    public const string FolderIndexName = "ix_situations_folder";

    public void Configure(EntityTypeBuilder<Situation> builder)
    {
        builder.ToTable("situations");
        builder.HasKey(situation => situation.Id);
        builder.Property(situation => situation.Id).ValueGeneratedNever();
        builder.Property(situation => situation.AreaKind).HasConversion<string>().HasMaxLength(20);
        builder.Property(situation => situation.AreaOwnerId).HasColumnName("area_id");
        builder.Property(situation => situation.FolderId);
        builder.Property(situation => situation.Title).IsRequired();
        builder.Property(situation => situation.NormalizedTitle).IsRequired();
        builder.Property(situation => situation.Sport).HasMaxLength(50).IsRequired();
        builder.Property(situation => situation.FieldType).HasMaxLength(20).IsRequired();
        builder.Property(situation => situation.FormatVersion);
        builder.Property(situation => situation.CreatedAt);
        builder.Property(situation => situation.CreatedBy);
        builder.Property(situation => situation.UpdatedAt);
        builder.Property(situation => situation.UpdatedBy);
        builder.Property(situation => situation.CurrentRevision).IsConcurrencyToken();
        builder.Property(situation => situation.DeletedAt);
        builder.Ignore(situation => situation.Area);
        builder.Ignore(situation => situation.IsDeleted);
        builder.HasIndex(situation => new { situation.AreaKind, situation.AreaOwnerId, situation.NormalizedTitle })
            .IsUnique()
            .HasFilter("deleted_at IS NULL")
            .HasDatabaseName(TitleIndexName);
        builder.HasIndex(situation => situation.FolderId)
            .HasFilter("deleted_at IS NULL")
            .HasDatabaseName(FolderIndexName);
    }
}
