import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { InferenceClient } from "~/infrastructure/ai/inference-client";
import { db } from "~/infrastructure/db/index";
import {
	CCIP_VECTOR_DIMENSIONS,
	ccipEmbeddings,
	mediaRegions,
	mediaSources,
	medias,
} from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import {
	AuthorRepository,
	DrizzleCharacterRepository,
	IpRepository,
	JobRepository,
	MediaRepository,
	ProjectRepository,
	DrizzleSourceRepository,
	TagRepository,
} from "~/infrastructure/db/repositories";
import { services } from "~/infrastructure/service-registry";
import { BulkOperationService } from "~/infrastructure/services/bulk-operation-service";
import { MediaService } from "~/infrastructure/services/media-service";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

const MEDIA_NOT_FOUND_PATTERN = /Media.*not found/;

describe("deleteMedia Integration", () => {
	let testMediaId: string;
	let directory: string;
	const mediaSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
	const missingId = "a0000000-0000-4000-8000-000000000000";

	async function createFile(filePath: string) {
		await writeFile(path.join(directory, filePath), "image");
		return MediaRepository.create({
			mediaSourceId,
			filePath,
			fileName: filePath,
			fileSize: 5,
			description: null,
			mediaType: "image",
			width: 1,
			height: 1,
		});
	}

	async function createVector(mediaId: string) {
		const now = new Date();
		const [region] = await db
			.insert(mediaRegions)
			.values({
				mediaId,
				kind: "full",
				sourceModifiedAt: now,
			})
			.returning();
		const [vector] = await db
			.insert(ccipEmbeddings)
			.values({
				regionId: region.id,
				embedding: Array.from({ length: CCIP_VECTOR_DIMENSIONS }, () => 1),
				model: "test",
				embeddingVersion: 1,
				mediaModifiedAt: now,
				extractedAt: now,
			})
			.returning();
		return vector.id;
	}

	beforeAll(async () => {
		directory = await mkdtemp(path.join(tmpdir(), "si-media-delete-"));
		services.registerMediaRepository(MediaRepository);
		services.registerSourceRepository(DrizzleSourceRepository);
		services.registerMediaStorage(ServerMediaStorage);
		services.registerTagRepository(TagRepository);
		services.registerImageProcessor(ImageProcessor);
		services.registerAuthorRepository(AuthorRepository);
		services.registerProjectRepository(ProjectRepository);
		services.registerCharacterRepository(DrizzleCharacterRepository);
		services.registerIpRepository(IpRepository);
		services.registerJobRepository(JobRepository);
		services.registerAiClient(new InferenceClient());

		await db.delete(medias);

		// テスト用のmedia sourceを作成
		await db
			.insert(mediaSources)
			.values({
				id: mediaSourceId,
				name: "Test Source",
				type: "local",
				connectionInfo: { path: directory },
			})
			.onConflictDoNothing();
		testMediaId = (await createFile("to_delete.png")).id;
	});

	afterAll(async () => {
		// クリーンアップ
		await db.delete(medias);
		await rm(directory, { recursive: true, force: true });
	});

	it("should successfully delete media from the database", async () => {
		await MediaService.deleteMedia(mediaSourceId, testMediaId);

		// メディアがデータベースから削除されたことを確認します。
		const mediaInDb = await db
			.select()
			.from(medias)
			.where(eq(medias.id, testMediaId));
		expect(mediaInDb.length).toBe(0);
	});

	it("should throw an error if mediaId is not found for the given mediaSourceId", async () => {
		await expect(
			MediaService.deleteMedia(mediaSourceId, missingId),
		).rejects.toThrow(MEDIA_NOT_FOUND_PATTERN);
	});

	it("should throw a ZodError for an invalid mediaId format", async () => {
		const invalidMediaId = "invalid-uuid";
		await expect(
			MediaService.deleteMedia(mediaSourceId, invalidMediaId),
		).rejects.toBeInstanceOf(ZodError);
	});

	it("should throw a ZodError for an invalid mediaSourceId format", async () => {
		const invalidSourceId = "invalid-uuid";
		await expect(
			MediaService.deleteMedia(invalidSourceId, testMediaId),
		).rejects.toBeInstanceOf(ZodError);
	});

	it("cleans a committed single deletion once even if an observer fails", async () => {
		const { id, filePath } = await createFile("single-delete.png");
		const vectorId = await createVector(id);
		const observer = vi.fn(() => {
			throw new Error("observer failed");
		});
		const unsubscribe = RealtimeEventBus.subscribeToSource(
			mediaSourceId,
			observer,
		);
		try {
			await MediaService.deleteMedia(mediaSourceId, id);
			await expect(MediaService.deleteMedia(mediaSourceId, id)).rejects.toThrow(
				MEDIA_NOT_FOUND_PATTERN,
			);
			expect(
				await db
					.select()
					.from(ccipEmbeddings)
					.where(eq(ccipEmbeddings.id, vectorId)),
			).toEqual([]);
			await expect(
				readFile(path.join(directory, filePath)),
			).rejects.toMatchObject({ code: "ENOENT" });
			expect(observer).toHaveBeenCalledExactlyOnceWith(
				expect.objectContaining({
					event: "media-deleted",
					data: expect.objectContaining({ mediaId: id, filePath }),
				}),
			);
		} finally {
			unsubscribe();
		}
	});

	it("leaves files and observers untouched when an external transaction rolls back", async () => {
		const { id, filePath } = await createFile("rolled-back-delete.png");
		const observer = vi.fn();
		const unsubscribe = RealtimeEventBus.subscribeToSource(
			mediaSourceId,
			observer,
		);
		try {
			await expect(
				db.transaction(async (tx) => {
					await MediaService.deleteMedia(mediaSourceId, id, tx);
					expect(await MediaRepository.findById(id, tx)).toBeNull();
					throw new Error("roll back deletion");
				}),
			).rejects.toThrow("roll back deletion");
			expect(await MediaRepository.findById(id)).not.toBeNull();
			await expect(
				readFile(path.join(directory, filePath), "utf8"),
			).resolves.toBe("image");
			expect(observer).not.toHaveBeenCalled();
		} finally {
			unsubscribe();
		}
	});

	it("runs one round of bulk cleanup for repeated and concurrent requests", async () => {
		const media = await createFile("bulk-delete.png");
		const vectorId = await createVector(media.id);
		const observer = vi.fn();
		const unsubscribe = RealtimeEventBus.subscribeToSource(
			mediaSourceId,
			observer,
		);
		try {
			const results = await Promise.allSettled([
				BulkOperationService.bulkDeleteMedia(mediaSourceId, [
					media.id,
					media.id,
				]),
				BulkOperationService.bulkDeleteMedia(mediaSourceId, [media.id]),
			]);
			expect(results.map(({ status }) => status).sort()).toEqual([
				"fulfilled",
				"rejected",
			]);
			expect(await MediaRepository.findById(media.id)).toBeNull();
			expect(
				await db
					.select()
					.from(ccipEmbeddings)
					.where(eq(ccipEmbeddings.id, vectorId)),
			).toEqual([]);
			await expect(
				readFile(path.join(directory, media.filePath)),
			).rejects.toMatchObject({ code: "ENOENT" });
			expect(observer).toHaveBeenCalledExactlyOnceWith(
				expect.objectContaining({
					event: "media-deleted",
					data: expect.objectContaining({ mediaId: media.id }),
				}),
			);
		} finally {
			unsubscribe();
		}
	});

	it("rolls back a bulk group with an invalid source or missing media", async () => {
		const { id, filePath } = await createFile("invalid-bulk-delete.png");
		const observer = vi.fn();
		const unsubscribe = RealtimeEventBus.subscribeToSource(
			mediaSourceId,
			observer,
		);
		try {
			await expect(
				BulkOperationService.bulkDeleteMedia(missingId, [id]),
			).rejects.toThrow("Media source not found");
			await expect(
				BulkOperationService.bulkDeleteMedia(mediaSourceId, [id, missingId]),
			).rejects.toThrow(`Media with ID ${missingId} does not belong`);
			expect(await MediaRepository.findById(id)).not.toBeNull();
			await expect(
				readFile(path.join(directory, filePath), "utf8"),
			).resolves.toBe("image");
			expect(observer).not.toHaveBeenCalled();
		} finally {
			unsubscribe();
		}
	});

	it("keeps rows, files and observers intact if the CCIP cascade fails", async () => {
		const { id, filePath } = await createFile("vector-delete-rollback.png");
		const vectorId = await createVector(id);
		const observer = vi.fn();
		const unsubscribe = RealtimeEventBus.subscribeToSource(
			mediaSourceId,
			observer,
		);
		await db.execute(sql`CREATE TABLE test_delete_vector_guard (
			embedding_id uuid REFERENCES ccip_embeddings(id)
		)`);
		try {
			await db.execute(
				sql`INSERT INTO test_delete_vector_guard VALUES (${vectorId})`,
			);
			await expect(
				BulkOperationService.bulkDeleteMedia(mediaSourceId, [id]),
			).rejects.toThrow("Failed to bulk delete media");
			expect(await MediaRepository.findById(id)).not.toBeNull();
			expect(
				await db
					.select()
					.from(ccipEmbeddings)
					.where(eq(ccipEmbeddings.id, vectorId)),
			).toHaveLength(1);
			await expect(
				readFile(path.join(directory, filePath), "utf8"),
			).resolves.toBe("image");
			expect(observer).not.toHaveBeenCalled();
		} finally {
			unsubscribe();
			await db.execute(sql`DROP TABLE test_delete_vector_guard`);
		}
	});
});
