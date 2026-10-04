using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TacticalBoard.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSituations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "situations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    area_kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    area_id = table.Column<Guid>(type: "uuid", nullable: false),
                    folder_id = table.Column<Guid>(type: "uuid", nullable: true),
                    title = table.Column<string>(type: "text", nullable: false),
                    normalized_title = table.Column<string>(type: "text", nullable: false),
                    sport = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    field_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    format_version = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: false),
                    current_revision = table.Column<int>(type: "integer", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_situations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "situation_revisions",
                columns: table => new
                {
                    situation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<int>(type: "integer", nullable: false),
                    document = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_situation_revisions", x => new { x.situation_id, x.number });
                    table.ForeignKey(
                        name: "fk_situation_revisions_situations_situation_id",
                        column: x => x.situation_id,
                        principalTable: "situations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_situations_area_title",
                table: "situations",
                columns: new[] { "area_kind", "area_id", "normalized_title" },
                unique: true,
                filter: "deleted_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "situation_revisions");

            migrationBuilder.DropTable(
                name: "situations");
        }
    }
}
