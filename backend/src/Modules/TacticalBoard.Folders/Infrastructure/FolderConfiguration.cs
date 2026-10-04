using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TacticalBoard.Folders.Domain;

namespace TacticalBoard.Folders.Infrastructure;

/// <summary>The <c>folders</c> table: the flat folders of every area (arc42 ch. 8.15).</summary>
internal sealed class FolderConfiguration : IEntityTypeConfiguration<Folder>
{
    /// <summary>
    /// Names are unique per area among non-deleted folders: a unique index on the normalized name,
    /// partial on <c>deleted_at IS NULL</c> (PostgreSQL syntax, kept inside the data-access layer,
    /// ADR-002). It also serves listing an area's folders.
    /// </summary>
    public const string NameIndexName = "ix_folders_area_name";

    public void Configure(EntityTypeBuilder<Folder> builder)
    {
        builder.ToTable("folders");
        builder.HasKey(folder => folder.Id);
        builder.Property(folder => folder.Id).ValueGeneratedNever();
        builder.Property(folder => folder.AreaKind).HasConversion<string>().HasMaxLength(20);
        builder.Property(folder => folder.AreaOwnerId).HasColumnName("area_id");
        builder.Property(folder => folder.Name).HasMaxLength(FolderName.MaxLength).IsRequired();
        builder.Property(folder => folder.NormalizedName).IsRequired();
        builder.Property(folder => folder.CreatedAt);
        builder.Property(folder => folder.CreatedBy);
        builder.Property(folder => folder.UpdatedAt);
        builder.Property(folder => folder.UpdatedBy);
        builder.Property(folder => folder.DeletedAt);
        builder.Ignore(folder => folder.Area);
        builder.Ignore(folder => folder.IsDeleted);
        builder.HasIndex(folder => new { folder.AreaKind, folder.AreaOwnerId, folder.NormalizedName })
            .IsUnique()
            .HasFilter("deleted_at IS NULL")
            .HasDatabaseName(NameIndexName);
    }
}
