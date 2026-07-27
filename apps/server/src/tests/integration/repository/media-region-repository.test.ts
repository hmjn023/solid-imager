import path from "node:path";
import {
	createMediaRegionRevision,
	createMediaSourceRevision,
} from "@solid-imager/core/domain/media/revision";
import { createMediaRegionRepository } from "@solid-imager/db/repositories/media-region-repository";
import {
	mediaRelationsTable,
	mediaSources,
	medias,
} from "@solid-imager/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createPglite } from "~/infrastructure/db/pglite";
import * as schema from "~/infrastructure/db/schema";

const SOURCE_ID = "10000000-0000-4000-8000-000000000001";
const MEDIA_ID = "20000000-0000-4000-8000-000000000002";
const MODIFIED_AT = new Date("2026-07-20T00:00:00.000Z");

describe("MediaRegionRepository", () => {
	let client: ReturnType<typeof createPglite> | undefined;

	afterEach(async () => {
		await client?.close();
		client = undefined;
	});

	it("uses optimistic revisions and preserves a derivative after region deletion", async () => {
		client = createPglite();
		const database = drizzle(client, { schema });
		const migrationsFolder = process.cwd().endsWith("apps/server")
			? path.resolve(process.cwd(), "drizzle")
			: path.resolve(process.cwd(), "apps/server/drizzle");
		await migrate(database, { migrationsFolder });
		await database.insert(mediaSources).values({
			id: SOURCE_ID,
			name: "Region source",
			description: null,
			type: "local",
			connectionInfo: { path: "/tmp/region-source" },
		});
		await database.insert(medias).values({
			id: MEDIA_ID,
			mediaSourceId: SOURCE_ID,
			filePath: "source.png",
			fileName: "source.png",
			mediaType: "image",
			width: 100,
			height: 200,
			fileSize: 500,
			modifiedAt: MODIFIED_AT,
		});

		const sourceRevision = await createMediaSourceRevision({
			mediaId: MEDIA_ID,
			mediaSourceId: SOURCE_ID,
			modifiedAt: MODIFIED_AT,
			fileSize: 500,
			width: 100,
			height: 200,
		});
		const bbox = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
		const initialRevision = await createMediaRegionRevision({
			sourceRevision,
			kind: "manual",
			...bbox,
			label: "first",
			detector: null,
			detectorModel: null,
			detectorVersion: null,
			manualReason: "test",
		});
		const repository = createMediaRegionRepository(() => database);
		const region = await repository.create({
			mediaId: MEDIA_ID,
			kind: "manual",
			bbox,
			sourceWidth: 100,
			sourceHeight: 200,
			sourceModifiedAt: MODIFIED_AT,
			sourceRevision,
			regionRevision: initialRevision,
			label: "first",
			manualReason: "test",
			detectionKey: null,
			detector: null,
			detectorModel: null,
			detectorVersion: null,
			score: null,
		});

		const nextRevision = await createMediaRegionRevision({
			sourceRevision,
			kind: "manual",
			...bbox,
			label: "updated",
			detector: null,
			detectorModel: null,
			detectorVersion: null,
			manualReason: "test",
		});
		const updated = await repository.update(region.id, initialRevision, {
			label: "updated",
			regionRevision: nextRevision,
			updatedAt: new Date("2026-07-21T00:00:00.000Z"),
		});
		expect(updated?.label).toBe("updated");
		await expect(
			repository.update(region.id, initialRevision, {
				label: "lost update",
				regionRevision: "a".repeat(64),
				updatedAt: new Date(),
			}),
		).resolves.toBeNull();

		const child = await repository.createMaterialized({
			media: {
				mediaSourceId: SOURCE_ID,
				filePath: "source.region.webp",
				fileName: "source.region.webp",
				mediaType: "image",
				width: 30,
				height: 80,
				fileSize: 200,
				description: null,
				createdAt: MODIFIED_AT,
				modifiedAt: MODIFIED_AT,
			},
			parentMediaId: MEDIA_ID,
			sourceRegionId: region.id,
			derivationKey: "derivation-key",
			snapshot: {
				regionId: region.id,
				regionRevision: nextRevision,
				sourceRevision,
				bbox,
				label: "updated",
				profile: { transparent: false },
				profileVersion: "crop-v1",
				rendererVersion: "test-renderer-v1",
			},
		});
		expect(
			await repository.findMaterializedByDerivationKey("derivation-key"),
		).toMatchObject({ id: child.id });

		await expect(repository.delete(region.id, nextRevision)).resolves.toBe(
			true,
		);
		const [relation] = await database
			.select()
			.from(mediaRelationsTable)
			.where(eq(mediaRelationsTable.derivationKey, "derivation-key"));
		expect(relation?.sourceRegionId).toBeNull();
		const [persistedChild] = await database
			.select()
			.from(medias)
			.where(eq(medias.id, child.id));
		expect(persistedChild?.id).toBe(child.id);
	});
});
