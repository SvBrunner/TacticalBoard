using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TacticalBoard.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AllowNewAccountAfterDeletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_users_issuer_subject",
                table: "users");

            migrationBuilder.CreateIndex(
                name: "ix_users_issuer_subject",
                table: "users",
                columns: new[] { "issuer", "subject" },
                unique: true,
                filter: "deleted_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_users_issuer_subject",
                table: "users");

            migrationBuilder.CreateIndex(
                name: "ix_users_issuer_subject",
                table: "users",
                columns: new[] { "issuer", "subject" },
                unique: true);
        }
    }
}
