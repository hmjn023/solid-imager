import { createFileRoute } from "@tanstack/solid-router";
import { SyncService } from "~/application/services/sync-service";
import { bootstrap } from "~/infrastructure/bootstrap";

export const Route = createFileRoute("/api/sync/package")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				bootstrap();
				const url = new URL(request.url);
				const sourceId = url.searchParams.get("sourceId");
				const filesParam = url.searchParams.get("files");

				if (!sourceId || !filesParam) {
					return new Response("Missing sourceId or files parameter", { status: 400 });
				}

				const files = JSON.parse(filesParam);
				if (!Array.isArray(files)) {
					return new Response("Invalid files parameter", { status: 400 });
				}

				// Check basic auth secret
				const syncSecret = process.env.SYNC_SECRET || "default_sync_secret";
				if (request.headers.get("X-Sync-Secret") !== syncSecret) {
					return new Response("Unauthorized", { status: 401 });
				}

				const zipStream = await SyncService.prepareSyncPackage(sourceId, files);

				return new Response(zipStream as any, {
					headers: {
						"Content-Type": "application/zip",
						"Content-Disposition": `attachment; filename="sync-package-${sourceId}.zip"`,
					},
				});
			},
		},
	},
});
