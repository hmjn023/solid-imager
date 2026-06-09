import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ORPCError, os } from "@orpc/server";
import { createClient } from "@solid-imager/client";
import type { NapiBBox } from "@solid-imager/core/domain/tagging/schemas";
import {
	batchTaggingRequestSchema,
	ccipDifferenceRequestSchema,
	ccipFeatureRequestSchema,
	tagImageRequestSchema,
} from "@solid-imager/core/domain/tagging/schemas";
import { and, asc, eq, getTableColumns, inArray, isNull } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { db } from "~/infrastructure/db";
import {
	mediaCharacters,
	mediaIps,
	medias,
	mediaTags,
} from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";

function isRemoteServerLocal(url: string): boolean {
	try {
		const host = new URL(url).hostname;
		return (
			host === "localhost" ||
			host === "127.0.0.1" ||
			host === "::1" ||
			host === "0.0.0.0"
		);
	} catch {
		return true;
	}
}

function getRemoteServerUrl(): string | undefined {
	const config = services.getConfigService().getConfig();
	const url = config.ai.baseUrl;
	if (!url || url.trim() === "") return undefined;
	return url;
}

async function readFileBuffer(filePath: string): Promise<Buffer> {
	return fs.promises.readFile(filePath);
}

function createRemoteOprcClient(remoteUrl: string, timeoutMs: number) {
	return createClient({
		url: remoteUrl,
		fetch: async (request: Request, init?: RequestInit) => {
			const controller = new AbortController();
			const t = setTimeout(() => controller.abort(), timeoutMs);
			try {
				return await fetch(request, {
					...init,
					signal: controller.signal,
				});
			} finally {
				clearTimeout(t);
			}
		},
	}) as any;
}

async function callRemoteTagging(
	remoteUrl: string,
	fileBuffer: Buffer,
	fileName: string,
	timeoutMs: number,
): Promise<unknown> {
	const file = new File([new Uint8Array(fileBuffer)], fileName);
	const remoteOrpc = createRemoteOprcClient(remoteUrl, timeoutMs);
	return remoteOrpc.ai.tag({ file });
}

async function callRemoteCrop(
	remoteUrl: string,
	fileBuffer: Buffer,
	fileName: string,
	timeoutMs: number,
): Promise<unknown> {
	const file = new File([new Uint8Array(fileBuffer)], fileName);
	const remoteOrpc = createRemoteOprcClient(remoteUrl, timeoutMs);
	return remoteOrpc.ai.detectAndCropCharacters({ file });
}

async function cropDetection(
	imagePath: string,
	det: { bbox: NapiBBox; label: string; score: number },
	idx: number,
	transparent: boolean,
) {
	const { x1, y1, x2, y2 } = det.bbox;
	const w = Math.round(x2 - x1);
	const h = Math.round(y2 - y1);

	let cropBuffer: Buffer;
	let _format: string;

	if (transparent) {
		const cropPath = path.join(
			tmpdir(),
			`crop-seg-${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}.png`,
		);
		await sharp(imagePath)
			.extract({
				left: Math.round(x1),
				top: Math.round(y1),
				width: w,
				height: h,
			})
			.png()
			.toFile(cropPath);
		try {
			const { segmentRgbaWithIsnetis } = await import("dghs-imgutils-rs");
			cropBuffer = Buffer.from(await segmentRgbaWithIsnetis(cropPath));
			_format = "png";
		} finally {
			await fs.promises.unlink(cropPath).catch(() => {});
		}
	} else {
		cropBuffer = await sharp(imagePath)
			.extract({
				left: Math.round(x1),
				top: Math.round(y1),
				width: w,
				height: h,
			})
			.webp()
			.toBuffer();
		_format = "webp";
	}

	return {
		index: idx,
		bbox: { x1, y1, x2, y2 },
		label: det.label,
		score: det.score,
		imageBase64: cropBuffer.toString("base64"),
		width: w,
		height: h,
	};
}

export const aiRouter = {
	tag: os
		.input(
			z.union([
				z.object({ file: z.instanceof(File) }),
				tagImageRequestSchema, // mediaSourceId + mediaId
			]),
		)
		.handler(async ({ input }) => {
			try {
				if ("file" in input) {
					const buffer = await input.file.arrayBuffer();
					return await taggingService.getTags(buffer);
				}

				const { mediaSourceId, mediaId } = input;
				if (!(mediaSourceId && mediaId)) {
					throw new Error("mediaSourceId and mediaId are required");
				}

				const remoteUrl = getRemoteServerUrl();
				const config = services.getConfigService().getConfig();
				if (remoteUrl && !isRemoteServerLocal(remoteUrl)) {
					const media = await services.getMediaRepository().findById(mediaId);
					if (!media) {
						throw new Error("Media not found");
					}
					const mediaSource = await services
						.getSourceRepository()
						.findById(media.mediaSourceId);
					if (mediaSource?.type !== "local") {
						throw new Error(
							"Only local media sources are supported for remote tagging",
						);
					}
					const connectionInfo = mediaSource.connectionInfo as
						| Record<string, unknown>
						| null
						| undefined;
					if (!connectionInfo || typeof connectionInfo.path !== "string") {
						throw new Error(
							"Media source connection path is missing or invalid",
						);
					}
					const fullPath = path.join(connectionInfo.path, media.filePath);
					const fileBuffer = await readFileBuffer(fullPath);
					return (await callRemoteTagging(
						remoteUrl,
						fileBuffer,
						path.basename(fullPath),
						config.ai.timeoutMs,
					)) as import("@solid-imager/core/domain/tagging/schemas").TaggingResponse;
				}

				return await taggingService.getTagsForMedia(mediaSourceId, mediaId);
			} catch (error) {
				logger.error({ err: error, input }, "AI tagging failed");
				const message =
					error instanceof Error ? error.message : "Unknown error";
				throw new ORPCError("UNPROCESSABLE_CONTENT", {
					message: `AI tagging failed: ${message}`,
				});
			}
		}),

	ccipFeature: os
		.input(
			z.union([
				z.object({ file: z.instanceof(File) }),
				ccipFeatureRequestSchema,
			]),
		)
		.handler(async ({ input }) => {
			if ("file" in input) {
				const buffer = await input.file.arrayBuffer();
				return await taggingService.getCcipFeature(buffer);
			}

			const { mediaSourceId, mediaId } = input;
			if (!(mediaSourceId && mediaId)) {
				throw new Error("mediaSourceId and mediaId are required");
			}

			return await taggingService.getCcipFeatureForMedia(
				mediaSourceId,
				mediaId,
			);
		}),

	ccipDifference: os
		.input(ccipDifferenceRequestSchema)
		.handler(
			async ({ input }) =>
				await taggingService.getCcipDifference(input.feature1, input.feature2),
		),

	scanBatchTaggingTargets: os
		.input(batchTaggingRequestSchema)
		.handler(async ({ input }) => {
			const { mediaSourceId, force } = input;

			const results = await db
				.select({
					...getTableColumns(medias),
				})
				.from(medias)
				.leftJoin(
					mediaTags,
					and(eq(mediaTags.mediaId, medias.id), eq(mediaTags.source, "AI")),
				)
				.leftJoin(
					mediaCharacters,
					and(
						eq(mediaCharacters.mediaId, medias.id),
						eq(mediaCharacters.source, "AI"),
					),
				)
				.leftJoin(
					mediaIps,
					and(eq(mediaIps.mediaId, medias.id), eq(mediaIps.source, "AI")),
				)
				.where(
					and(
						eq(medias.mediaType, "image"),
						mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
						force
							? undefined
							: and(
									isNull(mediaTags.mediaId),
									isNull(mediaCharacters.mediaId),
									isNull(mediaIps.mediaId),
								),
					),
				)
				.orderBy(asc(medias.id));

			return results;
		}),

	batchTagging: os
		.input(batchTaggingRequestSchema)
		.handler(async ({ input }) => {
			const jobRepo = services.getJobRepository();
			await jobRepo.create({
				type: "bulk_tagging_dispatch",
				mediaSourceId: input.mediaSourceId, // Optional but good for tracking if provided
				payload: input,
			});
			return { success: true, message: "Batch tagging started" };
		}),

	startBatchTaggingWithIds: os
		.input(
			batchTaggingRequestSchema.extend({
				mediaIds: z.array(z.string()),
			}),
		)
		.handler(async ({ input }) => {
			const { mediaIds, mediaSourceId, force } = input;
			const jobRepo = services.getJobRepository();

			const parentJob = await jobRepo.create({
				type: "bulk_tagging_parent",
				mediaSourceId,
				payload: {
					total: mediaIds.length,
					processed: 0,
				},
			});

			const mediaItems = await db.query.medias.findMany({
				where: inArray(medias.id, mediaIds),
				columns: { id: true, mediaSourceId: true },
			});

			const foundIds = new Set(mediaItems.map((m) => m.id));
			const notFoundIds = mediaIds.filter((id) => !foundIds.has(id));
			if (notFoundIds.length > 0) {
				logger.warn(
					{ notFoundIds },
					"Some media IDs were not found for batch tagging",
				);
			}

			await Promise.all(
				mediaItems.map((media) =>
					jobRepo.create({
						type: "auto_tagging",
						mediaSourceId: media.mediaSourceId,
						parentId: parentJob.id,
						payload: {
							mediaId: media.id,
							force,
						},
					}),
				),
			);

			return {
				success: true,
				message: "Batch tagging started with selected media.",
				jobId: parentJob.id,
			};
		}),

	detectAndCropCharacters: os
		.input(
			z.union([
				z.object({
					mediaId: z.string().uuid(),
					transparent: z.boolean().optional().default(false),
				}),
				z.object({
					file: z.instanceof(File),
					transparent: z.boolean().optional().default(false),
				}),
			]),
		)
		.handler(async ({ input }) => {
			try {
				const transparent = input.transparent ?? false;

				if ("file" in input) {
					const buffer = Buffer.from(await input.file.arrayBuffer());
					const tmpPath = path.join(
						tmpdir(),
						`crop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
					);
					await fs.promises.writeFile(tmpPath, buffer);
					try {
						const { detectPerson } = await import("dghs-imgutils-rs");
						const detections = await detectPerson(tmpPath);

						const resultDetections = await Promise.all(
							detections.map(async (det, idx) =>
								cropDetection(tmpPath, det, idx, transparent),
							),
						);

						return { detections: resultDetections };
					} finally {
						await fs.promises.unlink(tmpPath).catch(() => {});
					}
				}

				const { mediaId } = input;
				const media = await services.getMediaRepository().findById(mediaId);
				if (!media) {
					throw new Error("Media not found");
				}
				const mediaSource = await services
					.getSourceRepository()
					.findById(media.mediaSourceId);
				if (!mediaSource) {
					throw new Error("Media source not found");
				}
				if (mediaSource.type !== "local") {
					throw new Error(
						"Only local media sources are supported for character detection",
					);
				}

				const connectionInfo = mediaSource.connectionInfo as
					| Record<string, unknown>
					| null
					| undefined;
				if (!connectionInfo || typeof connectionInfo.path !== "string") {
					throw new Error("Media source connection path is missing or invalid");
				}
				const fullPath = path.join(connectionInfo.path, media.filePath);

				const remoteUrl = getRemoteServerUrl();
				const config = services.getConfigService().getConfig();
				if (remoteUrl && !isRemoteServerLocal(remoteUrl)) {
					const fileBuffer = await readFileBuffer(fullPath);
					return (await callRemoteCrop(
						remoteUrl,
						fileBuffer,
						path.basename(fullPath),
						config.ai.timeoutMs,
					)) as {
						detections: Array<{
							index: number;
							bbox: NapiBBox;
							label: string;
							score: number;
							imageBase64: string;
							width: number;
							height: number;
						}>;
					};
				}

				const { detectPerson } = await import("dghs-imgutils-rs");
				const detections = await detectPerson(fullPath);

				const resultDetections = await Promise.all(
					detections.map(async (det, idx) =>
						cropDetection(fullPath, det, idx, transparent),
					),
				);

				return { detections: resultDetections };
			} catch (error) {
				logger.error(
					{ err: error, input },
					"Character detection and cropping failed",
				);
				const message =
					error instanceof Error ? error.message : "Unknown error";
				throw new ORPCError("UNPROCESSABLE_CONTENT", {
					message: `Character detection and cropping failed: ${message}`,
				});
			}
		}),
};
