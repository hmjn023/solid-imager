/**
 * Tags API Client
 * Handles all API calls related to tags
 *
 * NOTE: Migrated to use oRPC ✅
 */

import type {
  newTagSchema,
  updateTagSchema,
} from "@solid-imager/core/domain/tags/schemas";
import type { z } from "zod";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

/**
 * Fetches all available tags
 * @returns Array of tags
 */
export function fetchTags() {
  return orpc.tags.list();
}

/**
 * Fetches a single tag by ID
 * @param id - Tag ID
 * @returns Tag
 */
export function fetchTag(id: string) {
  return orpc.tags.get({ id });
}

/**
 * Creates a new tag
 * @param data - Tag data
 * @returns Created tag
 */
export function createTag(data: z.infer<typeof newTagSchema>) {
  return orpc.tags.create(data);
}

/**
 * Updates an existing tag
 * @param id - Tag ID
 * @param data - Updated tag data
 * @returns Updated tag
 */
export function updateTag(id: string, data: z.infer<typeof updateTagSchema>) {
  return orpc.tags.update({ id, data });
}

/**
 * Deletes a tag
 * @param id - Tag ID
 */
export async function deleteTag(id: string): Promise<void> {
  await orpc.tags.delete({ id });
}
