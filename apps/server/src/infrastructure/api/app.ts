import fs from "node:fs/promises";
import type { OpenAPI } from "@orpc/contract";
import { OpenAPIGenerator } from "@orpc/openapi";
import { RPCHandler } from "@orpc/server/fetch";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import { Elysia } from "elysia";
import { MediaService } from "~/application/services/media-service";
import { appRouter } from "~/domain/shared/api-contract";
import { bootstrap } from "~/infrastructure/bootstrap";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { openApiTags } from "./openapi-tags";

// Initialize services (DI)
bootstrap();

const handler = new RPCHandler(appRouter);

// Generate OpenAPI spec for oRPC endpoints
const openApiGenerator = new OpenAPIGenerator();

// Mapping of router prefixes to tag names
const routerTagMap: Record<string, string> = {
	sources: "Media Sources",
	media: "Media",
	tags: "Tags",
	categories: "Categories",
	projects: "Projects",
	characters: "Characters",
	ips: "IPs",
	thumbnails: "Thumbnails",
	downloads: "Downloads",
	directories: "Directories",
	ai: "AI",
	utils: "Utilities",
};

/**
 * OpenAPIスペックにタグを自動割り当てする
 */
// biome-ignore lint/suspicious/noExplicitAny: OpenAPI spec object structure
function assignTags(spec: any) {
	if (!spec.paths) {
		return;
	}

	for (const pathItem of Object.values(spec.paths)) {
		if (!pathItem) {
			continue;
		}

		for (const method of ["get", "post", "put", "delete", "patch"] as const) {
			// biome-ignore lint/suspicious/noExplicitAny: Dynamic method access on OpenAPI paths
			const operation = (pathItem as any)[method] as
				| OpenAPI.OperationObject
				| undefined;
			if (operation?.operationId) {
				const routerName = operation.operationId.split(".")[0];
				const tagName = routerTagMap[routerName];

				if (tagName) {
					operation.tags = [tagName];
				}
			}
		}
	}
}

const UNIT_SIZE = 1024;
const KILOBYTE = UNIT_SIZE;
const MEGABYTE = UNIT_SIZE * KILOBYTE;
const GIGABYTE = UNIT_SIZE * MEGABYTE;

// 50GB limit for ZIP imports
const MAX_BODY_SIZE_GB = 50;
const MAX_BODY_SIZE = MAX_BODY_SIZE_GB * GIGABYTE;

/**
 * Elysia アプリケーション
 */
export const app = new Elysia({
	// @ts-expect-error: bodyLimit is supported at runtime but missing from current ElysiaConfig type
	bodyLimit: MAX_BODY_SIZE,
})
	.onError(({ code, error, request }) => {
		if (error instanceof ResourceNotFoundError) {
			// biome-ignore lint/suspicious/noExplicitAny: error is narrowed by instanceof
			return new Response(JSON.stringify({ error: (error as any).message }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		logger.error(
			{ err: error, code, path: request.url },
			"Unhandled Elysia Error",
		);
		return new Response(JSON.stringify({ error: String(error) }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	})
	// OpenAPI spec for oRPC endpoints
	.get("/api/openapi.json", async () => {
		const spec = await openApiGenerator.generate(appRouter, {
			info: {
				title: "Solid Imager oRPC API",
				version: "1.0.0",
				description:
					"API for managing media sources, media files, tags, and AI-powered features",
			},
			servers: [
				{
					url: "http://localhost:3000/api/rpc",
					description: "Development server (oRPC)",
				},
			],
			tags: openApiTags,
		});

		assignTags(spec);

		return spec;
	})
	// Media Content
	.get(
		"/api/sources/:mediaSourceId/:mediaId",
		async ({ params: { mediaSourceId, mediaId } }) => {
			try {
				const { buffer, contentType } = await MediaService.getMediaContent(
					mediaSourceId,
					mediaId,
				);
				return new Response(buffer as unknown as BodyInit, {
					status: 200,
					headers: { "Content-Type": contentType },
				});
			} catch (error) {
				logger.error({ err: error, mediaId }, "Failed to serve media content");
				return new Response("Media not found", { status: 404 });
			}
		},
	)
	// Thumbnails
	.get(
		"/api/sources/:mediaSourceId/:mediaId/thumbnail",
		async ({ params: { mediaSourceId, mediaId } }) => {
			try {
				const thumbnailPath = getThumbnailPath(mediaSourceId, mediaId);
				try {
					await fs.access(thumbnailPath);
				} catch {
					return new Response("Thumbnail not found", { status: 404 });
				}

				const thumbnailBuffer = await fs.readFile(thumbnailPath);
				return new Response(thumbnailBuffer, {
					headers: { "Content-Type": "image/webp" },
				});
			} catch (error) {
				logger.error({ err: error, mediaId }, "Failed to serve thumbnail");
				return new Response("Thumbnail error", { status: 500 });
			}
		},
	)
	// Media Source Dump Download
	.get(
		"/api/sources/:mediaSourceId/dump",
		async ({ params: { mediaSourceId }, query }) => {
			try {
				const mode = query?.mode as string | undefined;
				const dumpMode = (mode === "zip" ? "zip" : "json") as "json" | "zip";

				const { BackupService } = await import(
					"~/application/services/backup-service"
				);

				const result = await BackupService.createDump(mediaSourceId, dumpMode);

				if (dumpMode === "zip") {
					return new Response(result as ReadableStream, {
						headers: {
							"Content-Type": "application/zip",
							"Content-Disposition": `attachment; filename="source-${mediaSourceId}-dump.zip"`,
						},
					});
				}

				// JSON mode
				return new Response(JSON.stringify(result), {
					headers: {
						"Content-Type": "application/json",
						"Content-Disposition": `attachment; filename="source-${mediaSourceId}-dump.json"`,
					},
				});
			} catch (error) {
				logger.error({ err: error, mediaSourceId }, "Failed to generate dump");
				return new Response("Dump generation failed", { status: 500 });
			}
		},
	)
	// Media Source ZIP Import
	.post(
		"/api/sources/:mediaSourceId/import",
		async ({ params: { mediaSourceId }, request }) => {
			let tempFilePath: string | null = null;
			try {
				if (!request.body) {
					return new Response("File stream is required", { status: 400 });
				}

				const { BackupService } = await import(
					"~/application/services/backup-service"
				);
				const { randomUUID } = await import("node:crypto");
				const path = await import("node:path");
				const os = await import("node:os");
				const { Readable } = await import("node:stream");
				const { pipeline } = await import("node:stream/promises");
				const { createWriteStream } = await import("node:fs");

				// Create temp file path
				tempFilePath = path.join(os.tmpdir(), `import-${randomUUID()}.zip`);

				// Convert Web Stream to Node Readable
				// biome-ignore lint/suspicious/noExplicitAny: stream casting
				const webStream = request.body as ReadableStream<any>;
				// biome-ignore lint/suspicious/noExplicitAny: node stream casting
				const nodeStream = Readable.fromWeb(webStream as any);

				// Write stream to temp file
				await pipeline(nodeStream, createWriteStream(tempFilePath));

				// Process import from file
				const result = await BackupService.importSourceZip(
					mediaSourceId,
					tempFilePath,
				);

				return Response.json(result);
			} catch (error) {
				logger.error({ err: error, mediaSourceId }, "Failed to import ZIP");
				return new Response(
					JSON.stringify({
						success: false,
						message: (error as Error).message,
					}),
					{ status: 500, headers: { "Content-Type": "application/json" } },
				);
			} finally {
				// Clean up temp file
				if (tempFilePath) {
					const nodeFs = await import("node:fs/promises");
					try {
						await nodeFs.unlink(tempFilePath);
					} catch {
						// ignore
					}
				}
			}
		},
		{
			parse: "none", // Disable Elysia body parser to handle raw body stream
		},
	)
	.all(
		"/*",
		async ({ request }: { request: Request }) => {
			const { response } = await handler.handle(request, {
				prefix: "/api/rpc",
			});
			return response ?? new Response("Not Found", { status: 404 });
		},
		{
			parse: "none", // Disable Elysia body parser to prevent "body already used" error
		},
	);
