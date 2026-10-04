using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TacticalBoard.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFolders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "folders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    area_kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    area_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    normalized_name = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_folders", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_situations_folder",
                table: "situations",
                column: "folder_id",
                filter: "deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_folders_area_name",
                table: "folders",
                columns: new[] { "area_kind", "area_id", "normalized_name" },
                unique: true,
                filter: "deleted_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "folders");

            migrationBuilder.DropIndex(
                name: "ix_situations_folder",
                table: "situations");
        }
    }
}
