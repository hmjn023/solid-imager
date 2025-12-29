import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "~/infrastructure/db/index";
import {
  characters,
  mediaCharacters as mediaCharsTable,
  mediaSources,
  medias,
} from "~/infrastructure/db/schema";

// Mock @solidjs/router
vi.mock("@solidjs/router", () => ({
  cache: (fn: any, _name: any) => fn,
}));

// HTTP Status Constants
const HTTP_OK = 200;
const HTTP_CREATED = 201;

// Helper Types
type CharacterHandlers = {
  getCharacters: () => Promise<Response>;
  createCharacter: (event: any) => Promise<Response>;
  getCharacterById: (event: any) => Promise<Response>;
  updateCharacter: (event: any) => Promise<Response>;
  deleteCharacter: (event: any) => Promise<Response>;
};

type MediaCharacterHandlers = {
  getCharactersForMedia: (event: any) => Promise<Response>;
  addCharacterToMedia: (event: any) => Promise<Response>;
  removeCharacterFromMedia: (event: any) => Promise<Response>;
};

// Mock APIEvent-like objects
const createPostEvent = (body: any) => ({
  request: new Request("http://localhost/api/characters", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }),
  params: {},
  nativeEvent: {} as any,
});

const createPatchEvent = (id: string, body: any) => ({
  request: new Request(`http://localhost/api/characters/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }),
  params: { id },
  nativeEvent: {} as any,
});

const createDeleteEvent = (id: string) => ({
  request: new Request(`http://localhost/api/characters/${id}`, {
    method: "DELETE",
  }),
  params: { id },
  nativeEvent: {} as any,
});

const createMediaEvent = (
  mediaSourceId: string,
  mediaId: string,
  body?: any
) => ({
  request: new Request(
    `http://localhost/api/sources/${mediaSourceId}/${mediaId}/characters`,
    {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { "Content-Type": "application/json" } : {},
    }
  ),
  params: { mediaSourceId, mediaId },
  nativeEvent: {} as any,
});

const createMediaDeleteEvent = (
  mediaSourceId: string,
  mediaId: string,
  body: any
) => ({
  request: new Request(
    `http://localhost/api/sources/${mediaSourceId}/${mediaId}/characters`,
    {
      method: "DELETE",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  ),
  params: { mediaSourceId, mediaId },
  nativeEvent: {} as any,
});

describe("Character API Integration Tests (V2)", () => {
  let characterHandlers: CharacterHandlers;
  let mediaCharacterHandlers: MediaCharacterHandlers;

  beforeAll(async () => {
    process.env.USE_REPO_V2 = "true";
    const charIndex = await import("~/routes/api/characters/index");
    const charId = await import("~/routes/api/characters/[id]");
    const mediaChar = await import(
      "~/routes/api/sources/[mediaSourceId]/[mediaId]/characters"
    );

    characterHandlers = {
      getCharacters: charIndex.GET,
      createCharacter: charIndex.POST,
      getCharacterById: charId.GET,
      updateCharacter: charId.PATCH,
      deleteCharacter: charId.DELETE,
    };

    mediaCharacterHandlers = {
      getCharactersForMedia: mediaChar.GET,
      addCharacterToMedia: mediaChar.POST,
      removeCharacterFromMedia: mediaChar.DELETE,
    };
  });

  afterEach(async () => {
    // Clear database tables
    try {
      await db.delete(mediaCharsTable);
      await db.delete(characters);
      await db.delete(medias);
      await db.delete(mediaSources);
    } catch (e) {
      console.error("Cleanup failed:", e);
    }
  });

  it("should create and retrieve characters", async () => {
    const newChar = { name: "Test Character", description: "Test Description" };
    const createRes = await characterHandlers.createCharacter(
      createPostEvent(newChar)
    );
    expect(createRes.status).toBe(HTTP_CREATED);
    const created = await createRes.json();
    expect(created.name).toBe(newChar.name);
    expect(created.id).toBeDefined();

    const getRes = await characterHandlers.getCharacters();
    expect(getRes.status).toBe(HTTP_OK);
    const charList = await getRes.json();
    expect(charList).toHaveLength(1);
    expect(charList[0].id).toBe(created.id);
  });

  it("should update and delete a character", async () => {
    const createRes = await characterHandlers.createCharacter(
      createPostEvent({ name: "To Update" })
    );
    const created = await createRes.json();

    const updateRes = await characterHandlers.updateCharacter(
      createPatchEvent(created.id, { name: "Updated Name" })
    );
    expect(updateRes.status).toBe(HTTP_OK);
    const updated = await updateRes.json();
    expect(updated.name).toBe("Updated Name");

    const deleteRes = await characterHandlers.deleteCharacter(
      createDeleteEvent(created.id)
    );
    expect(deleteRes.status).toBe(HTTP_OK);

    const getRes = await characterHandlers.getCharacters();
    const charList = await getRes.json();
    expect(charList).toHaveLength(0);
  });

  it("should handle media-character associations", async () => {
    // Setup: Create Source, Media, and Character
    const [source] = await db
      .insert(mediaSources)
      .values({
        name: "Test Source",
        connectionInfo: { path: "/test" },
        type: "local",
      })
      .returning();

    const [media] = await db
      .insert(medias)
      .values({
        mediaSourceId: source.id,
        filePath: "test.jpg",
        fileName: "test.jpg",
        mediaType: "image",
        width: 100,
        height: 100,
        indexedAt: new Date(),
      })
      .returning();

    const createCharRes = await characterHandlers.createCharacter(
      createPostEvent({ name: "Media Char" })
    );
    const char = await createCharRes.json();

    // Add association
    const addRes = await mediaCharacterHandlers.addCharacterToMedia(
      createMediaEvent(source.id, media.id, { characterId: char.id })
    );
    expect(addRes.status).toBe(HTTP_CREATED);

    // Get for media
    const getAssocRes = await mediaCharacterHandlers.getCharactersForMedia(
      createMediaEvent(source.id, media.id)
    );
    expect(getAssocRes.status).toBe(HTTP_OK);
    const assocChars = await getAssocRes.json();
    expect(assocChars).toHaveLength(1);
    expect(assocChars[0].id).toBe(char.id);

    // Remove association
    const removeRes = await mediaCharacterHandlers.removeCharacterFromMedia(
      createMediaDeleteEvent(source.id, media.id, { characterId: char.id })
    );
    expect(removeRes.status).toBe(HTTP_OK);

    // Verify removed
    const getAssocRes2 = await mediaCharacterHandlers.getCharactersForMedia(
      createMediaEvent(source.id, media.id)
    );
    const assocChars2 = await getAssocRes2.json();
    expect(assocChars2).toHaveLength(0);
  });
});
