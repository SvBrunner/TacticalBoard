using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Infrastructure;

/// <summary>The <c>users</c> table.</summary>
internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    /// <summary>
    /// The unique index on issuer + subject among non-deleted users: an identity has at most one
    /// account at a time; after its account was deleted it gets a new, empty one on its next login (arc42 ch. 8.13).
    /// </summary>
    public const string IdentityIndexName = "ix_users_issuer_subject";

    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        builder.HasKey(user => user.Id);
        builder.Property(user => user.Id).ValueGeneratedNever();
        builder.Property(user => user.Issuer).HasMaxLength(ExternalIdentity.MaxIssuerLength).IsRequired();
        builder.Property(user => user.Subject).HasMaxLength(ExternalIdentity.MaxSubjectLength).IsRequired();
        builder.Property(user => user.DisplayNameValue).HasColumnName("display_name").HasMaxLength(DisplayName.MaxLength).IsRequired();
        builder.Property(user => user.IsSystemAdministrator);
        builder.Property(user => user.IsBlocked);
        builder.Property(user => user.CreatedAt);
        builder.Property(user => user.DeletedAt);
        builder.Ignore(user => user.Identity);
        builder.Ignore(user => user.DisplayName);
        builder.Ignore(user => user.IsDeleted);
        builder.Ignore(user => user.CanSignIn);
        builder.HasIndex(user => new { user.Issuer, user.Subject })
            .IsUnique()
            .HasFilter("deleted_at IS NULL")
            .HasDatabaseName(IdentityIndexName);
    }
}
