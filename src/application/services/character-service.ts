import {
  deleteCharacter,
  insertCharacter,
  selectCharacterById,
  selectCharacters,
  updateCharacter,
} from "~/infrastructure/db/queries/characters";

/**
 * CharacterService - キャラクター管理機能
 * Feature 11: キャラクター管理機能
 */

/**
 * Provides services for managing characters.
 */
export const CharacterService = {
  /**
   * Retrieves all characters.
   * @returns {Promise<any>} A list of all characters.
   */
  async getAllCharacters() {
    return await selectCharacters();
  },

  /**
   * Creates a new character.
   * @param {object} characterData - The data for the new character.
   * @param {string} characterData.name - The name of the character.
   * @param {number} [characterData.ipId] - The ID of the intellectual property (IP) the character belongs to.
   * @param {string} [characterData.description] - An optional description for the character.
   * @returns {Promise<any>} The newly created character.
   */
  async createCharacter(characterData: {
    name: string;
    ipId?: number;
    description?: string;
  }) {
    const result = await insertCharacter(characterData);
    return result[0];
  },

  /**
   * Retrieves details of a specific character by its ID.
   * @param {number} characterId - The ID of the character.
   * @returns {Promise<any>} The details of the specified character.
   */
  async getCharacterDetails(characterId: number) {
    return await selectCharacterById(characterId);
  },

  /**
   * Updates an existing character.
   * @param {number} characterId - The ID of the character to update.
   * @param {object} characterData - The updated data for the character.
   * @param {string} [characterData.name] - The new name of the character.
   * @param {number} [characterData.ipId] - The new IP ID the character belongs to.
   * @param {string} [characterData.description] - The new description for the character.
   * @returns {Promise<any>} The updated character.
   */
  async updateCharacter(
    characterId: number,
    characterData: {
      name?: string;
      ipId?: number;
      description?: string;
    }
  ) {
    return await updateCharacter(characterId, characterData);
  },

  /**
   * Deletes a character by its ID.
   * @param {number} characterId - The ID of the character to delete.
   * @returns {Promise<any>} Confirmation of deletion.
   */
  async deleteCharacter(characterId: number) {
    return await deleteCharacter(characterId);
  },
};
