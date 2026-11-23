import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { z } from "zod";
import { apiRequest } from "./api";
import {
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
} from "./fixture";
import { expect } from "./test";

const createdEntitySchema = z.object({ id: z.uuid() });

/** Add only a shared positive tag, proving recommendations need no relation/vector. */
export async function withRelatedMediaTag(
	request: APIRequestContext,
	run: () => Promise<void>,
	apiOrigin = "",
): Promise<void> {
	const created = await apiRequest(
		request,
		"tags/create",
		{ name: `Related tag ${randomUUID()}` },
		apiOrigin,
	);
	expect(created.ok()).toBe(true);
	const { id } = createdEntitySchema.parse(await created.json());
	try {
		const linked = await apiRequest(
			request,
			"media/bulkTag",
			{
				mediaSourceId: E2E_SOURCE_ID,
				mediaIds: [E2E_PRIMARY_MEDIA_ID, E2E_SIMILAR_MEDIA_ID],
				tagsToAdd: [id],
				tagsToRemove: [],
			},
			apiOrigin,
		);
		expect(linked.ok()).toBe(true);
		await run();
	} finally {
		const removed = await apiRequest(request, "tags/delete", { id }, apiOrigin);
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
			const response = await apiRequest(
				request,
				`${entity}/create`,
				{ name: `Related media ${randomUUID()}` },
				apiOrigin,
			);
			expect(response.ok()).toBe(true);
			const { id } = createdEntitySchema.parse(await response.json());
			created.push({ entity, id });
			for (const mediaId of [E2E_PRIMARY_MEDIA_ID, E2E_SIMILAR_MEDIA_ID]) {
				const relation = await apiRequest(
					request,
					`${entity}/addToMedia`,
					{
						mediaId,
						[entity === "characters" ? "characterId" : "ipId"]: id,
					},
					apiOrigin,
				);
				expect(relation.ok()).toBe(true);
			}
		}
		await run();
	} finally {
		for (const { entity, id } of created) {
			const response = await apiRequest(
				request,
				`${entity}/delete`,
				{ id },
				apiOrigin,
			);
			expect(response.ok()).toBe(true);
		}
	}
}
