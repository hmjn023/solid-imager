/**
 * Characters API Client
 * Extracted from src/lib/api/characters.ts
 */

/**
 * Fetches all characters from the API.
 * @returns {any[]} An array of character objects.
 */
export function getCharacters() {
  return [];
}

/**
 * Creates a new character via the API.
 * @param {object} data - The data for the new character.
 * @param {string} data.name - The name of the character.
 * @param {number} [data.ipId] - An optional ID of the intellectual property (IP) this character belongs to.
 * @param {string} [data.description] - An optional description for the character.
 * @returns {object} The newly created character object with an ID.
 */
export function createCharacter(data: {
  name: string;
  ipId?: number;
  description?: string;
}) {
  const { name, ipId, description } = data;
  return { id: 1, name, ipId, description };
}

/**
 * Fetches a single character by its ID from the API.
 * @param {number} id - The ID of the character to fetch.
 * @returns {object} The character object matching the ID.
 */
export function getCharacterById(id: number) {
  return {
    id,
    name: `Character ${id}`,
    description: `Description for character ${id}`,
  };
}

import type { UpdateCharacterBody } from "~/routes/api/charactors/[id]";

/**
 * Updates an existing character via the API.
 * @param {number} id - The ID of the character to update.
 * @param {object} data - The updated data for the character.
 * @param {string} [data.name] - The new name of the character.
 * @param {number} [data.ipId] - The new IP ID the character belongs to.
 * @param {string} [data.description] - The new description for the character.
 * @returns {object} The updated character object.
 */
export function updateCharacter(
  id: number,
  data: UpdateCharacterBody
) {
  const { name, description } = data;
  return {
    id,
    name: name || `Character ${id}`,
    description: description || `Description for character ${id}`,
  };
}

/**
 * Deletes a character by its ID via the API.
 * @param {number} _id - The ID of the character to delete.
 * @returns {object} An object indicating the success of the deletion.
 */
export function deleteCharacter(_id: number) {
  return { success: true };
}
