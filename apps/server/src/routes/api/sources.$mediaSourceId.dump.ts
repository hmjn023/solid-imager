import { createFileRoute } from "@tanstack/solid-router";
import { BackupService } from "~/application/services/backup-service";
import { initServices } from "~/infrastructure/bootstrap";

export const Route = createFileRoute("/api/sources/$mediaSourceId/dump")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				initServices();

				const { mediaSourceId } = params;
				const { searchParams } = new URL(request.url);
				const rawMode = searchParams.get("mode");
				const mode =
					rawMode === "zip" || rawMode === "lancedb" ? rawMode : "json";
				const includeImages = searchParams.get("includeImages") === "true";
				const result = await BackupService.createDump(mediaSourceId, mode, {
					includeImages,
				});

				if (mode === "zip") {
					return new Response(result as ReadableStream, {
						headers: {
							"Content-Type": "application/zip",
							"Content-Disposition": `attachment; filename="source-${mediaSourceId}-dump.zip"`,
						},
					});
				}

				if (mode === "lancedb") {
					return new Response(result as ReadableStream, {
						headers: {
							"Content-Type": "application/gzip",
							"Content-Disposition": `attachment; filename="source-${mediaSourceId}-dump.tar.gz"`,
						},
					});
				}

				return Response.json(result, {
					headers: {
						"Content-Disposition": `attachment; filename="source-${mediaSourceId}-dump.json"`,
					},
				});
			},
		},
	},
});
