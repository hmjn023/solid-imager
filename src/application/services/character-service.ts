import {
  deleteCharacter,
  deleteMediaCharacter,
  insertCharacter,
  insertMediaCharacter,
  selectCharacterById,
  selectCharacters,
  selectCharactersByMediaId,
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
    ipId?: string;
    description?: string;
  }) {
    const result = await insertCharacter(characterData);
    return result[0];
  },

  /**
   * Retrieves details of a specific character by its ID.
   * @param {string} characterId - The ID of the character.
   * @returns {Promise<any>} The details of the specified character.
   */
  async getCharacterDetails(characterId: string) {
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
    characterId: string,
    characterData: {
      name?: string;
      ipId?: string;
      description?: string;
    }
  ) {
    return await updateCharacter(characterId, characterData);
  },

  /**
   * Deletes a character by its ID.
   * @param {string} characterId - The ID of the character to delete.
   * @returns {Promise<any>} Confirmation of deletion.
   */
  async deleteCharacter(characterId: string) {
    return await deleteCharacter(characterId);
  },

  /**
   * Retrieves characters associated with a specific media.
   * @param {string} mediaId - The ID of the media.
   * @returns {Promise<any>} A list of characters associated with the media.
   */
  async getCharactersForMedia(mediaId: string) {
    return await selectCharactersByMediaId(mediaId);
  },

  /**
   * Adds a character to a media.
   * @param {string} mediaId - The ID of the media.
   * @param {string} characterId - The ID of the character to add.
   * @returns {Promise<any>} The created association.
   */
  async addCharacterToMedia(mediaId: string, characterId: string) {
    return await insertMediaCharacter(mediaId, characterId);
  },

  /**
   * Removes a character from a media.
   * @param {string} mediaId - The ID of the media.
   * @param {string} characterId - The ID of the character to remove.
   * @returns {Promise<any>} Confirmation of removal.
   */
  async removeCharacterFromMedia(mediaId: string, characterId: string) {
    return await deleteMediaCharacter(mediaId, characterId);
  },
};
