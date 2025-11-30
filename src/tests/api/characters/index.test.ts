import { describe, expect, it, vi } from "vitest";
import { CharacterService } from "~/application/services/character-service";
import { GET, POST } from "~/routes/api/characters/index";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;

// Mock the CharacterService
vi.mock("~/application/services/character-service", () => ({
  // biome-ignore lint/style/useNamingConvention: Mocking a PascalCase export
  CharacterService: {
    getAllCharacters: vi.fn(),
    createCharacter: vi.fn(),
    deleteCharacter: vi.fn(),
  },
}));

describe("GET /api/characters", () => {
  it("should return an array of characters", async () => {
    (CharacterService.getAllCharacters as any).mockResolvedValue([]);

    const response = await GET();
    expect(response.status).toBe(HTTP_OK);
    const data = await response.json();
    expect(data).toBeInstanceOf(Array);
  });
});

describe("POST /api/characters", () => {
  it("should create and return new character", async () => {
    const newData = {
      name: "Test Character",
      description: "Test description",
    };

    const mockCreatedCharacter = {
      id: 1,
      ...newData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (CharacterService.createCharacter as any).mockResolvedValue(
      mockCreatedCharacter
    );

    const request = new Request("http://localhost/api/characters", {
      method: "POST",
      body: JSON.stringify(newData),
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(HTTP_CREATED);

    const data = await response.json();
    expect(data).toBeDefined();
    expect(data.name).toBe(newData.name);
    expect(data.id).toBeDefined();
  });

  it("should return 400 for invalid data", async () => {
    const invalidData = {
      // Missing name
      description: "Invalid character",
    };

    const request = new Request("http://localhost/api/characters", {
      method: "POST",
      body: JSON.stringify(invalidData),
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(HTTP_BAD_REQUEST);
  });
});
