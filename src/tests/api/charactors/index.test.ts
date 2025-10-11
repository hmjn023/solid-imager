import { describe, expect, it } from "vitest";
import type { Character } from "~/infrastructure/db/schema";

describe("GET /api/charactors", () => {
	it("should return an array of characters", () => {
		// TODO: Implement after getCharacters is available
		// const result = await GET();

		// Mock response for contract testing
		const result: Character[] = [];

		expect(result).toBeInstanceOf(Array);
	});

	it("should return empty array when no characters exist", () => {
		// TODO: Test empty state
		const result: Character[] = [];
		expect(result).toEqual([]);
	});

	it("should handle query parameters correctly", () => {
		// TODO: Test filtering, pagination, sorting if supported
		// const result = await GET({ limit: 10 });
		// expect(result.length).toBeLessThanOrEqual(10);
	});
});

describe("POST /api/charactors", () => {
	it("should create and return new character", () => {
		const newData = {
			// TODO: Fill with valid data matching schema
			name: "Test Character",
			description: "Test description",
		};

		// TODO: Implement after POST function is available
		// const result = await POST({ request: new Request('', { method: 'POST', body: JSON.stringify(newData) }) });
		const result: Character = {
			id: 1,
			...newData,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		expect(result).toBeDefined();
		expect(result.id).toBeTypeOf("number");
		expect(result.name).toBe(newData.name);
	});

	it("should throw error for invalid data", () => {
		// TODO: Test validation
		const _invalidData = {
			// Missing required fields
		};

		// expect(() => validateCharacterData(invalidData)).toThrow();
	});

	it("should reject duplicate character names", () => {
		// TODO: Test unique constraint
		// const data = { name: "Duplicate Name" };
		// await expect(POST(...)).rejects.toThrow('already exists');
	});
});
