export function getCharacters() {
  return [];
}

export function createCharacter(data: {
  name: string;
  ipId?: number;
  description?: string;
}) {
  const { name, ipId, description } = data;
  return { id: 1, name, ipId, description };
}

export function getCharacterById(id: number) {
  return {
    id,
    name: `Character ${id}`,
    description: `Description for character ${id}`,
  };
}

export function updateCharacter(
  id: number,
  data: {
    name?: string;
    ipId?: number;
    description?: string;
  }
) {
  const { name, description } = data;
  return {
    id,
    name: name || `Character ${id}`,
    description: description || `Description for character ${id}`,
  };
}

export function deleteCharacter(_id: number) {
  return { success: true };
}
