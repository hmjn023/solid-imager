/**
 * Tags API Client
 * Extracted from src/lib/api/tags.ts
 */

export function getTags() {
  return [];
}

export function createTag(data: {
  name: string;
  description?: string;
  attribute?: string;
  color?: string;
}) {
  const { name, description, attribute, color } = data;
  return { id: 1, name, description, attribute, color };
}

export function getTagById(id: number) {
  return { id, name: `Tag ${id}`, description: `Description for tag ${id}` };
}

export function updateTag(
  id: number,
  data: {
    name?: string;
    description?: string;
    attribute?: string;
    color?: string;
  }
) {
  const { name, description } = data;
  return {
    id,
    name: name || `Tag ${id}`,
    description: description || `Description for tag ${id}`,
  };
}

export function deleteTag(_id: number) {
  return { success: true };
}
