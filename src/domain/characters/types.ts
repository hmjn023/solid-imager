/**
 * Characters Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents the data for a character.
 */
export type CharacterData = {
  /**
   * The name of the character.
   */
  name: string;
  /**
   * The ID of the IP (Intellectual Property) this character belongs to.
   */
  ipId?: number;
  /**
   * An optional description of the character.
   */
  description?: string;
};
