import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { z } from "zod";
import {
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
} from "./fixture";
import { expect } from "./test";

const createdEntitySchema = z.object({ json: z.object({ id: z.uuid() }) });

/** Add only a shared positive tag, proving recommendations need no relation/vector. */
export async function withRelatedMediaTag(
	request: APIRequestContext,
	run: () => Promise<void>,
	apiOrigin = "",
): Promise<void> {
	const created = await request.post(`${apiOrigin}/api/rpc/tags/create`, {
		data: { json: { name: `Related tag ${randomUUID()}` } },
	});
	expect(created.ok()).toBe(true);
	const {
		json: { id },
	} = createdEntitySchema.parse(await created.json());
	try {
		const linked = await request.post(`${apiOrigin}/api/rpc/media/bulkTag`, {
			data: {
				json: {
					mediaSourceId: E2E_SOURCE_ID,
					mediaIds: [E2E_PRIMARY_MEDIA_ID, E2E_SIMILAR_MEDIA_ID],
					tagsToAdd: [id],
					tagsToRemove: [],
				},
			},
		});
		expect(linked.ok()).toBe(true);
		await run();
	} finally {
		const removed = await request.post(`${apiOrigin}/api/rpc/tags/delete`, {
			data: { json: { id } },
		});
		expect(removed.ok()).toBe(true);
	}
}

/** Add temporary shared relations to the isolated images, then remove them. */
export async function withRelatedMedia(
	request: APIRequestContext,
	run: () => Promise<void>,
	apiOrigin = "",
): Promise<void> {
	const created: Array<{ entity: "characters" | "ips"; id: string }> = [];
	try {
		for (const entity of ["characters", "ips"] as const) {
			const response = await request.post(
				`${apiOrigin}/api/rpc/${entity}/create`,
				{
					data: { json: { name: `Related media ${randomUUID()}` } },
				},
			);
			expect(response.ok()).toBe(true);
			const {
				json: { id },
			} = createdEntitySchema.parse(await response.json());
			created.push({ entity, id });
			for (const mediaId of [E2E_PRIMARY_MEDIA_ID, E2E_SIMILAR_MEDIA_ID]) {
				const relation = await request.post(
					`${apiOrigin}/api/rpc/${entity}/addToMedia`,
					{
						data: {
							json: {
								mediaId,
								[entity === "characters" ? "characterId" : "ipId"]: id,
							},
						},
					},
				);
				expect(relation.ok()).toBe(true);
			}
		}
		await run();
	} finally {
		for (const { entity, id } of created) {
			const response = await request.post(
				`${apiOrigin}/api/rpc/${entity}/delete`,
				{
					data: { json: { id } },
				},
			);
			expect(response.ok()).toBe(true);
		}
	}
}
