import { createFileRoute } from "@tanstack/solid-router";
import { BackupService } from "~/application/services/backup-service";
import { bootstrap } from "~/infrastructure/bootstrap";

export const Route = createFileRoute("/api/sources/$mediaSourceId/dump")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				bootstrap();

				const { mediaSourceId } = params;
				const { searchParams } = new URL(request.url);
				const mode = searchParams.get("mode") === "zip" ? "zip" : "json";
				const result = await BackupService.createDump(mediaSourceId, mode);

				if (mode === "zip") {
					return new Response(result as ReadableStream, {
						headers: {
							"Content-Type": "application/zip",
							"Content-Disposition": `attachment; filename="source-${mediaSourceId}-dump.zip"`,
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
