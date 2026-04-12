import { createFileRoute } from "@tanstack/solid-router";
import { BackupService } from "~/application/services/backup-service";
import { bootstrap } from "~/infrastructure/bootstrap";

export const Route = createFileRoute("/api/sources/$mediaSourceId/import")({
	server: {
		handlers: {
			POST: async ({ params, request }) => {
				bootstrap();

				const { randomUUID } = await import("node:crypto");
				const fs = await import("node:fs");
				const nodeOs = await import("node:os");
				const path = await import("node:path");
				const { Readable } = await import("node:stream");
				const { pipeline } = await import("node:stream/promises");

				const tempFilePath = path.join(
					nodeOs.tmpdir(),
					`import-route-${randomUUID()}.zip`,
				);

				try {
					if (!request.body) {
						return new Response("Missing request body", { status: 400 });
					}

					await pipeline(
						Readable.fromWeb(request.body as any),
						fs.createWriteStream(tempFilePath),
					);

					return Response.json(
						await BackupService.importSourceZip(
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
