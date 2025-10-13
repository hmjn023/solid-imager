/**
 * CharacterService - キャラクター管理機能
 * Feature 11: キャラクター管理機能
 */

export const CharacterService = {
  // Feature 11: キャラクター管理機能
  async getAllCharacters() {
    // TODO: Get all characters
    throw new Error("Not implemented");
  },

  async createCharacter(_characterData: {
    name: string;
    ipId?: number;
    description?: string;
  }) {
    // TODO: Create new character
    throw new Error("Not implemented");
  },

  async getCharacterDetails(_characterId: number) {
    // TODO: Get character details by ID
    throw new Error("Not implemented");
  },

  async updateCharacter(
    _characterId: number,
    _characterData: {
      name?: string;
      ipId?: number;
      description?: string;
    }
  ) {
    // TODO: Update character
    throw new Error("Not implemented");
  },

  async deleteCharacter(_characterId: number) {
    // TODO: Delete character
    throw new Error("Not implemented");
  },
};
