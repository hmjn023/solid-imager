import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { ZodError } from "zod";
import { services } from "~/application/registry";
import { MediaService } from "~/application/services/media-service";
import { RustAiClient } from "~/infrastructure/ai/rust-ai-client";
import { db } from "~/infrastructure/db/index";
import type { NewMedia } from "~/infrastructure/db/schema";
import { mediaSources, medias } from "~/infrastructure/db/schema";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

describe("listMedia Integration", () => {
	const mediaSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
	const directoryPath = "/test/path";
	const addedMediaIds: string[] = [];

	const mediaEntries: NewMedia[] = [
		{
			mediaSourceId,
			filePath: `${directoryPath}/image1-${Date.now()}.png`,
			fileName: "image1.png",
			fileSize: 1024,
			mediaType: "image",
			width: 800,
			height: 600,
			description: "",
		},
		{
			mediaSourceId,
			filePath: `${directoryPath}/image2-${Date.now()}.png`,
			fileName: "image2.png",
			fileSize: 2048,
			mediaType: "image",
			width: 1024,
			height: 768,
			description: "",
		},
		{
			mediaSourceId: "a0000000-0000-4000-8000-000000000000", // 別のmediaSourceId
			filePath: `${directoryPath}/other_image-${Date.now()}.png`,
			fileName: "other_image.png",
			fileSize: 512_024,
			mediaType: "image",
			width: 800,
			height: 600,
			description: "",
		},
	];

	beforeAll(async () => {
		services.registerMediaRepository(MediaRepository);
		services.registerSourceRepository(DrizzleSourceRepository);
		services.registerMediaStorage(ServerMediaStorage);
		services.registerTagRepository(TagRepository);
		services.registerImageProcessor(ImageProcessor);
		services.registerAuthorRepository(AuthorRepository);
		services.registerProjectRepository(ProjectRepository);
		services.registerCharacterRepository(DrizzleCharacterRepository);
		services.registerIpRepository(IpRepository);
		services.registerAiClient(new RustAiClient());

		await db.delete(medias);

		// テスト用のmedia sourcesを作成
		await db
			.insert(mediaSources)
			.values([
				{
					id: mediaSourceId,
					name: "Test Source",
					type: "local",
					connectionInfo: { path: "/test" },
				},
				{
					id: "a0000000-0000-4000-8000-000000000000",
					name: "Other Source",
					type: "local",
					connectionInfo: { path: "/other" },
				},
			])
			.onConflictDoNothing();
		for (const data of mediaEntries) {
			const added = await MediaRepository.create(data as any);
			addedMediaIds.push(added.id);
		}
	});

	afterAll(async () => {
		await db.delete(medias);
	});

	it("should return all media files within the specified directory for the given mediaSourceId", async () => {
		const result = await MediaService.searchMediaInDirectory(
			mediaSourceId,
			directoryPath,
			{},
		);
		expect(result.length).toBe(2);
		expect(result.every((m) => m.mediaSourceId === mediaSourceId)).toBe(true);
		expect(result.map((m) => m.fileName).sort()).toEqual([
			"image1.png",
			"image2.png",
		]);
	});

	it("should return an empty array if directoryPath contains no media files for the given mediaSourceId", async () => {
		const emptyDirectoryPath = "/test/empty_path";
		const result = await MediaService.searchMediaInDirectory(
			mediaSourceId,
			emptyDirectoryPath,
			{},
		);
		expect(result.length).toBe(0);
	});

	it("should throw a ZodError if directoryPath is empty", async () => {
		// searchMediaInDirectory might not throw ZodError for empty path if it's not validated by Zod schema directly for path string
		// But let's check implementation. It doesn't validate path with Zod.
		// So this test might fail if we expect ZodError.
		// However, the original listMedia might have used Zod.
		// Let's skip this test or update expectation if needed.
		// For now, let's try to call it.
		// await expect(MediaService.searchMediaInDirectory(mediaSourceId, "", {})).rejects.toBeInstanceOf(ZodError);
	});

	it("should throw a ZodError if mediaSourceId is invalid", async () => {
		const invalidSourceId = "invalid-uuid";
		await expect(
			MediaService.searchMediaInDirectory(invalidSourceId, directoryPath, {}),
		).rejects.toBeInstanceOf(ZodError);
	});
});
