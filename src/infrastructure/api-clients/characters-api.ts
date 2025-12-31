/**
 * Characters API Client
 */

import { z } from "zod";
import { characterSchema } from "~/domain/characters/schemas";
import { apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

const characterListSchema = z.array(characterSchema);

export function fetchAllCharacters() {
  return apiRequest(API_ENDPOINTS.characters, characterListSchema);
}

export function createCharacter(data: {
  name: string;
  description?: string;
  ipId?: string;
}) {
  return apiRequest(API_ENDPOINTS.characters, characterSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateCharacter(
  id: string,
  data: { name?: string; description?: string; ipId?: string }
) {
  return apiRequest(`${API_ENDPOINTS.characters}/${id}`, characterSchema, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteCharacter(id: string) {
  return apiRequest(`${API_ENDPOINTS.characters}/${id}`, characterSchema, {
    method: "DELETE",
  });
}

export function fetchCharactersForMedia(sourceId: string, mediaId: string) {
  return apiRequest(
    API_ENDPOINTS.mediaCharacters(sourceId, mediaId),
    characterListSchema
  );
}

export function addCharacterToMedia(
  sourceId: string,
  mediaId: string,
  characterId: string
) {
  return apiRequest(API_ENDPOINTS.mediaCharacters(sourceId, mediaId), z.any(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId }),
  });
}

export function removeCharacterFromMedia(
  sourceId: string,
  mediaId: string,
  characterId: string
) {
  return apiRequest(API_ENDPOINTS.mediaCharacters(sourceId, mediaId), z.any(), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId }),
  });
}
