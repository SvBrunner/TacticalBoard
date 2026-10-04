using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TacticalBoard.Api.Persistence.Migrations
{
    /// <summary>
    /// Folder names: at most 64 characters instead of 100 (confirmed product decision, arc42 ch.
    /// 8.15). Fails if a stored folder has a longer name (only possible in databases from the short
    /// time the limit was 100; shorten such names first).
    /// </summary>
    public partial class LimitFolderNameLength : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "name",
                table: "folders",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "name",
                table: "folders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64);
        }
    }
}
