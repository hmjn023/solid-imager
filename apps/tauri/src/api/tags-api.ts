import type { TagResponse, newTagSchema, updateTagSchema } from "@solid-imager/core/domain/tags/schemas";
import type { z } from "zod";
import { client } from "~/orpc-client";

export function fetchTags(): Promise<TagResponse[]> {
	return client.tags.list() as unknown as Promise<TagResponse[]>;
}

export function fetchTag(id: string): Promise<TagResponse> {
	return client.tags.get({ id }) as unknown as Promise<TagResponse>;
}

export function createTag(data: z.infer<typeof newTagSchema>): Promise<TagResponse> {
	return client.tags.create(data) as unknown as Promise<TagResponse>;
}

export function updateTag(id: string, data: z.infer<typeof updateTagSchema>): Promise<TagResponse> {
	return client.tags.update({ id, data }) as unknown as Promise<TagResponse>;
}

export async function deleteTag(id: string): Promise<void> {
	await client.tags.delete({ id });
}
