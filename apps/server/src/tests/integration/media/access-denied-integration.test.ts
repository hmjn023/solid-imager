import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { db } from "~/infrastructure/db/index";
import { mediaSources } from "~/infrastructure/db/schema";
import { RustAiClient } from "~/infrastructure/ai/rust-ai-client";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import {
	AuthorRepository,
	DrizzleCharacterRepository,
	IpRepository,
	MediaRepository,
	ProjectRepository,
	DrizzleSourceRepository,
	TagRepository,
} from "~/infrastructure/db/repositories";
import { services } from "~/infrastructure/service-registry";
import { MediaService } from "~/infrastructure/services/media-service";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

describe("File System Access Denied Integration", () => {
	beforeAll(() => {
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
	});
	let directory: string;
	let sourceId: string;
	let mediaId: string;
	const fileName = "image.png";

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), "si-access-denied-"));
		await writeFile(join(directory, fileName), "existing media bytes");
		const [source] = await db
			.insert(mediaSources)
			.values({
				name: "Access denied test",
				type: "local",
				connectionInfo: { path: directory },
			})
			.returning();
		sourceId = source.id;
		const media = await MediaRepository.create({
			mediaSourceId: sourceId,
			filePath: fileName,
			fileName,
			mediaType: "image",
			fileSize: 20,
			width: 1,
			height: 1,
			description: null,
		});
		mediaId = media.id;
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await db.delete(mediaSources).where(eq(mediaSources.id, sourceId));
		await rm(directory, { recursive: true, force: true });
	});

	it("propagates a denied directory scan without changing registered media", async () => {
		const denied = Object.assign(new Error("Permission denied"), {
			code: "EACCES",
		});
		const scan = vi
			.spyOn(ServerMediaStorage, "scanDirectory")
			.mockRejectedValueOnce(denied);

		await expect(
			MediaService.registerExistingMedia(sourceId, directory),
		).rejects.toBe(denied);

		expect(scan).toHaveBeenCalledExactlyOnceWith(directory);
		expect(
			(await MediaService.getAllMedia(sourceId)).map((media) => media.id),
		).toEqual([mediaId]);
	});

	it("removes the database record even when deleting the physical file is denied", async () => {
		const denied = Object.assign(new Error("Permission denied"), {
			code: "EACCES",
		});
		const deleteFile = vi
			.spyOn(ServerMediaStorage, "deleteFile")
			.mockRejectedValueOnce(denied);

		await expect(
			MediaService.deleteMedia(sourceId, mediaId),
		).resolves.toBeUndefined();

		expect(deleteFile).toHaveBeenCalledExactlyOnceWith(directory, fileName);
		expect(await MediaRepository.findById(mediaId)).toBeNull();
		expect(await readFile(join(directory, fileName), "utf8")).toBe(
			"existing media bytes",
		);
	});
});
