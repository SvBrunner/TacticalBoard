using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.Situations.Infrastructure;

/// <summary>The <c>situation_revisions</c> table: every saved document as <c>jsonb</c> (ADR-009).</summary>
internal sealed class SituationRevisionConfiguration : IEntityTypeConfiguration<SituationRevision>
{
    /// <summary>The primary key (situation, number): two saves can't both write the same next revision.</summary>
    public const string PrimaryKeyName = "pk_situation_revisions";

    public void Configure(EntityTypeBuilder<SituationRevision> builder)
    {
        builder.ToTable("situation_revisions");
        builder.HasKey(revision => new { revision.SituationId, revision.Number }).HasName(PrimaryKeyName);
        builder.Property(revision => revision.Number).ValueGeneratedNever();
        builder.Property(revision => revision.Document).HasColumnType("jsonb").IsRequired();
        builder.Property(revision => revision.CreatedAt);
        builder.Property(revision => revision.CreatedBy);
        builder.HasOne<Situation>().WithMany().HasForeignKey(revision => revision.SituationId).OnDelete(DeleteBehavior.Restrict);
    }
}
