import { createFileRoute } from "@tanstack/solid-router";
import { BackupService } from "~/application/services/backup-service";
import { initServices } from "~/infrastructure/bootstrap";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";
import { webReadableToNodeStream } from "~/infrastructure/utils/stream-utils";

export const Route = createFileRoute("/api/sources/$mediaSourceId/import")({
	server: {
		handlers: {
			POST: async ({
				params,
				request,
			}: ServerRouteContext<{ mediaSourceId: string }>) => {
				initServices();

				const { randomUUID } = await import("node:crypto");
				const fs = await import("node:fs");
				const path = await import("node:path");
				const { pipeline } = await import("node:stream/promises");

				const tempDir = path.join(process.cwd(), ".cache", "import");
				await fs.promises.mkdir(tempDir, { recursive: true });
				const tempFilePath = path.join(
					tempDir,
					`import-route-${randomUUID()}.tar`,
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
						await BackupService.importSourceTar(
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
