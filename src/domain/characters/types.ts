/**
 * Characters Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents the data structure for a character.
 * @property {string} name - The name of the character.
 * @property {number} [ipId] - An optional ID of the intellectual property (IP) this character belongs to.
 * @property {string} [description] - An optional description for the character.
 */
export type CharacterData = {
  name: string;
  ipId?: number;
  description?: string;
};
