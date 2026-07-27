import {
	createCcipEmbeddingInputRevision,
	createMediaRegionRevision,
	createMediaSourceRevision,
} from "@solid-imager/core/domain/media/revision";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createPglite } from "~/infrastructure/db/pglite";

const MEDIA_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const MODIFIED_AT = new Date("2026-07-23T01:02:03.456Z");

describe("CCIP revision SQL parity", () => {
	let client: ReturnType<typeof createPglite> | undefined;

	afterEach(async () => {
		await client?.close();
		client = undefined;
	});

	it("matches the TypeScript source and full-region SHA-256 payloads", async () => {
		client = createPglite();
		const sourceRevision = await createMediaSourceRevision({
			mediaId: MEDIA_ID,
			mediaSourceId: SOURCE_ID,
			modifiedAt: MODIFIED_AT,
			fileSize: 123_456,
			width: 1024,
			height: 768,
		});
		const sourceResult = await client.query<{ revision: string }>(`
			SELECT encode(
				sha256(
					convert_to(
						concat(
							'{"version":1,"mediaId":', to_json($1::text)::text,
							',"mediaSourceId":', to_json($2::text)::text,
							',"modifiedAtMs":', floor(extract(epoch FROM $3::timestamp) * 1000)::bigint,
							',"fileSize":', $4::bigint,
							',"width":', $5::integer,
							',"height":', $6::integer, '}'
						),
						'UTF8'
					)
				),
				'hex'
			) AS revision
		`, [
			MEDIA_ID,
			SOURCE_ID,
			MODIFIED_AT,
			123_456,
			1024,
			768,
		]);
		expect(sourceResult.rows[0]?.revision).toBe(sourceRevision);
		const inputRevision = await createCcipEmbeddingInputRevision({
			sourceRevision,
			model: "ccip-model",
			embeddingVersion: 1,
			preprocessingProfile: "dghs-imgutils-rs/full-image-default/v1",
		});
		const inputResult = await client.query<{ revision: string }>(`
			SELECT encode(
				sha256(
					convert_to(
						concat(
							'{"version":1,"sourceRevision":', to_json($1::text)::text,
							',"model":', to_json($2::text)::text,
							',"embeddingVersion":', $3::integer,
							',"preprocessingProfile":', to_json($4::text)::text, '}'
						),
						'UTF8'
					)
				),
				'hex'
			) AS revision
		`, [
			sourceRevision,
			"ccip-model",
			1,
			"dghs-imgutils-rs/full-image-default/v1",
		]);
		expect(inputResult.rows[0]?.revision).toBe(inputRevision);

		const regionRevision = await createMediaRegionRevision({
			sourceRevision,
			kind: "full",
			x: null,
			y: null,
			width: null,
			height: null,
			label: null,
			detector: null,
			detectorModel: null,
			detectorVersion: null,
			manualReason: null,
		});
		const regionResult = await client.query<{ revision: string }>(`
			SELECT encode(
				sha256(
					convert_to(
						concat(
							'{"version":1,"sourceRevision":', to_json($1::text)::text,
							',"kind":', to_json('full'::text)::text,
							',"x":null,"y":null,"width":null,"height":null',
							',"label":null,"detector":null,"detectorModel":null',
							',"detectorVersion":null,"manualReason":null}'
						),
						'UTF8'
					)
				),
				'hex'
			) AS revision
		`, [sourceRevision]);
		expect(regionResult.rows[0]?.revision).toBe(regionRevision);
	});
});
