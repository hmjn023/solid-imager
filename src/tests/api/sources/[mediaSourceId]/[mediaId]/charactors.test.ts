import { describe, expect, it, vi } from "vitest";
import { CharacterService } from "~/application/services/character-service";
import {
  DELETE,
  GET,
  POST,
} from "~/routes/api/sources/[mediaSourceId]/[mediaId]/charactors";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;

// Mock the CharacterService
vi.mock("~/application/services/character-service", () => ({
  // biome-ignore lint/style/useNamingConvention: Mocking a PascalCase export
  CharacterService: {
    getCharactersForMedia: vi.fn(),
    addCharacterToMedia: vi.fn(),
    removeCharacterFromMedia: vi.fn(),
  },
}));

const mockParams = {
  mediaSourceId: "123e4567-e89b-12d3-a456-426614174000",
  mediaId: "123e4567-e89b-12d3-a456-426614174001",
};

describe("GET /api/sources/{mediaSourceId}/{mediaId}/charactors", () => {
  it("should return an array of characters", async () => {
    (CharacterService.getCharactersForMedia as any).mockResolvedValue([]);

    const response = await GET({ params: mockParams } as any);
    expect(response.status).toBe(HTTP_OK);
    const data = await response.json();
    expect(data).toBeInstanceOf(Array);
  });

  it("should return 400 for invalid params", async () => {
    const response = await GET({ params: {} } as any);
    expect(response.status).toBe(HTTP_BAD_REQUEST);
  });
});

describe("POST /api/sources/{mediaSourceId}/{mediaId}/charactors", () => {
  it("should add character to media", async () => {
    const mockCharacter = { id: 1, name: "Test Character" };
    (CharacterService.addCharacterToMedia as any).mockResolvedValue(
      mockCharacter
    );

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ characterId: 1 }),
    });

    const response = await POST({ params: mockParams, request } as any);
    expect(response.status).toBe(HTTP_CREATED);
    const data = await response.json();
    expect(data).toEqual(mockCharacter);
  });

  it("should return 400 for invalid body", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST({ params: mockParams, request } as any);
    expect(response.status).toBe(HTTP_BAD_REQUEST);
  });
});

describe("DELETE /api/sources/{mediaSourceId}/{mediaId}/charactors", () => {
  it("should remove character from media", async () => {
    const mockCharacter = { id: 1, name: "Test Character" };
    (CharacterService.removeCharacterFromMedia as any).mockResolvedValue(
      mockCharacter
    );

    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({ characterId: 1 }),
    });

    const response = await DELETE({ params: mockParams, request } as any);
    expect(response.status).toBe(HTTP_OK);
    const data = await response.json();
    expect(data).toEqual(mockCharacter);
  });

  it("should return 400 for invalid body", async () => {
    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({}),
    });

    const response = await DELETE({ params: mockParams, request } as any);
    expect(response.status).toBe(HTTP_BAD_REQUEST);
  });
});
