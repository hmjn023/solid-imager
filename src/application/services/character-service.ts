/**
 * CharacterService - キャラクター管理機能
 * Feature 11: キャラクター管理機能
 */

export const CharacterService = {
  // Feature 11: キャラクター管理機能
  getAllCharacters() {
    // TODO: Get all characters
    throw new Error("Not implemented");
  },

  createCharacter(_characterData: {
    name: string;
    ipId?: number;
    description?: string;
  }) {
    // TODO: Create new character
    throw new Error("Not implemented");
  },

  getCharacterDetails(_characterId: number) {
    // TODO: Get character details by ID
    throw new Error("Not implemented");
  },

  updateCharacter(
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

  deleteCharacter(_characterId: number) {
    // TODO: Delete character
    throw new Error("Not implemented");
  },
};
