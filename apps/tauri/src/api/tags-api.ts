import type { newTagSchema, updateTagSchema } from "@solid-imager/core/domain/tags/schemas";
import type { z } from "zod";
import { client } from "~/orpc-client";

export function fetchTags() {
	return client.tags.list();
}

export function fetchTag(id: string) {
	return client.tags.get({ id });
}

export function createTag(data: z.infer<typeof newTagSchema>) {
	return client.tags.create(data);
}

export function updateTag(id: string, data: z.infer<typeof updateTagSchema>) {
	return client.tags.update({ id, data });
}

export async function deleteTag(id: string): Promise<void> {
	await client.tags.delete({ id });
}
