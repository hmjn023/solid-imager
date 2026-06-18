import { createFileRoute } from "@tanstack/solid-router";
import { BackupService } from "~/application/services/backup-service";
import { initServices } from "~/infrastructure/bootstrap";
import { webReadableToNodeStream } from "~/infrastructure/utils/stream-utils";

export const Route = createFileRoute(
	"/api/sources/$mediaSourceId/import-lancedb",
)({
	server: {
		handlers: {
			POST: async ({ params, request }) => {
				initServices();

				const { randomUUID } = await import("node:crypto");
				const fs = await import("node:fs");
				const path = await import("node:path");
				const { pipeline } = await import("node:stream/promises");

				const tempDir = path.join(process.cwd(), ".cache", "lancedb-restore");
				await fs.promises.mkdir(tempDir, { recursive: true });
				const tempFilePath = path.join(
					tempDir,
					`import-lancedb-route-${randomUUID()}.tar`,
				);

				try {
					if (!request.body) {
						return new Response("Missing request body", { status: 400 });
					}

					await pipeline(
						webReadableToNodeStream(request.body),
						fs.createWriteStream(tempFilePath),
					);

					return Response.json(
						await BackupService.importLanceDB(
							params.mediaSourceId,
							tempFilePath,
						),
					);
				} finally {
					try {
						await fs.promises.unlink(tempFilePath);
					} catch {
						// ignore temp file cleanup failures
					}
				}
			},
		},
	},
});
