import path from "node:path";
import { getContentTypeFromExtension } from "@solid-imager/core/domain/media/utils/media-type-utils";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { createFileRoute } from "@tanstack/solid-router";
import { services } from "~/application/registry";
import { bootstrapServerRoute } from "~/infrastructure/server-route-bootstrap";

const resolveSafePath = (basePath: string, targetPath: string): string => {
	const resolvedPath = path.resolve(basePath, targetPath);
	const absoluteBase = path.resolve(basePath);

	if (
		resolvedPath !== absoluteBase &&
		!resolvedPath.startsWith(absoluteBase + path.sep)
	) {
		throw new Error(`Invalid path: ${targetPath}`);
	}
	return resolvedPath;
};

export const Route = createFileRoute("/api/sources/$mediaSourceId/$mediaId")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				bootstrapServerRoute();
				const { mediaSourceId, mediaId } = params;

				const media = await services.getMediaRepository().findById(mediaId);
				if (!media || media.mediaSourceId !== mediaSourceId) {
					return new Response("Media not found", { status: 404 });
				}

				const mediaSource = await services
					.getSourceRepository()
					.findById(mediaSourceId);
				if (mediaSource?.type !== "local") {
					return new Response("Invalid media source", { status: 400 });
				}

				const connectionInfo = localConnectionSchema.parse(
					mediaSource.connectionInfo,
				);
				const fullPath = resolveSafePath(connectionInfo.path, media.filePath);

				const file = Bun.file(fullPath);
				if (!(await file.exists())) {
					return new Response("File not found on disk", { status: 404 });
				}

				const contentType = getContentTypeFromExtension(media.fileName);
				return new Response(file, {
					headers: {
						"Cache-Control": "no-store",
						"Content-Type": contentType,
					},
				});
			},
		},
	},
});
