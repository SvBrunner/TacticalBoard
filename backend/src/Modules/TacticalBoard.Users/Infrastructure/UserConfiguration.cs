using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Infrastructure;

/// <summary>The <c>users</c> table.</summary>
internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    /// <summary>The unique index on issuer + subject; it covers deleted users too, so a deleted identity never gets a second account.</summary>
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
        builder.HasIndex(user => new { user.Issuer, user.Subject }).IsUnique().HasDatabaseName(IdentityIndexName);
    }
}
