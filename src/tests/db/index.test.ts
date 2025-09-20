import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid"; // Import uuid generator
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaSource, NewMediaSource } from "~/db/schema"; // Import Drizzle types
import * as schema from "~/db/schema";

// Mock environment variables
const mockEnv = {
	DB_HOST: "test_host",
	DB_PORT: "5432",
	DB_USER: "test_user",
	DB_PASSWORD: "test_password",
	DB_DATABASE: "test_database",
};

// Mock process.env before importing index.ts to ensure env vars are set
beforeEach(() => {
	for (const key in mockEnv) {
		process.env[key] = mockEnv[key as keyof typeof mockEnv];
	}
});

// Mock drizzle and pg
const mockDrizzle = {
	select: vi.fn(() => mockDrizzle),
	from: vi.fn(() => mockDrizzle), // Ensure from also returns mockDrizzle for chaining
	insert: vi.fn(() => mockDrizzle),
	values: vi.fn(() => mockDrizzle),
	returning: vi.fn(() => []), // Return an empty array for insert/update/delete by default
	update: vi.fn(() => mockDrizzle),
	set: vi.fn(() => mockDrizzle),
	where: vi.fn(() => mockDrizzle),
	delete: vi.fn(() => mockDrizzle),
};

vi.mock("drizzle-orm/node-postgres", () => ({
	drizzle: vi.fn(() => mockDrizzle),
}));

vi.mock("pg", () => ({
	Pool: vi.fn(() => ({
		query: vi.fn(),
		end: vi.fn(),
	})),
}));

// Import the functions *after* mocks are set up
// This is crucial for 'db' to use the mocked drizzle instance
// Using `await import` to ensure dynamic import after mocks
const {
	db,
	selectMediaSources,
	insertMediaSource,
	updateMediaSource,
	deleteMediaSource,
} = await import("../../db/index");

describe("Media Source Database Operations", () => {
	// Define a full MediaSource object that would be returned by the DB
	const fullMediaSource: MediaSource = {
		id: uuidv4(),
		name: "Test Source",
		description: "A test media source",
		type: "local",
		connectionInfo: { path: "/test/path" },
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	// Define a NewMediaSource object for insertion (without id, createdAt, updatedAt)
	const newMediaSource: NewMediaSource = {
		name: "New Test Source",
		description: "Another test media source",
		type: "sftp",
		connectionInfo: { path: "/new/path" },
	};

	// Define an updated MediaSource object
	const updatedMediaSource: MediaSource = {
		...fullMediaSource,
		name: "Updated Test Source",
		type: "s3",
		connectionInfo: { path: "/updated/path" },
		updatedAt: new Date(), // Simulate updated timestamp
	};

	// Reset mocks before each test
	beforeEach(() => {
		vi.clearAllMocks();
		// Ensure the mockDrizzle functions return 'mockDrizzle' for chaining
		mockDrizzle.select.mockReturnValue(mockDrizzle);
		mockDrizzle.from.mockReturnValue(mockDrizzle);
		mockDrizzle.insert.mockReturnValue(mockDrizzle);
		mockDrizzle.values.mockReturnValue(mockDrizzle);
		mockDrizzle.update.mockReturnValue(mockDrizzle);
		mockDrizzle.set.mockReturnValue(mockDrizzle);
		mockDrizzle.where.mockReturnValue(mockDrizzle);
		mockDrizzle.delete.mockReturnValue(mockDrizzle);
		mockDrizzle.returning.mockReturnValue([]); // Reset returning mock as well
	});

	describe("selectMediaSources", () => {
		it("should call db.select().from(mediaSources)", async () => {
			mockDrizzle.from.mockResolvedValueOnce([fullMediaSource]); // Mock the final return for select
			const result = await selectMediaSources();
			expect(mockDrizzle.select).toHaveBeenCalled();
			expect(mockDrizzle.from).toHaveBeenCalledWith(schema.mediaSources);
			expect(result).toEqual([fullMediaSource]);
		});
	});

	describe("insertMediaSource", () => {
		it("should call db.insert().values().returning() with the correct data", async () => {
			mockDrizzle.returning.mockResolvedValueOnce([fullMediaSource]); // Mock the return value as a full MediaSource
			const result = await insertMediaSource(newMediaSource);
			expect(mockDrizzle.insert).toHaveBeenCalledWith(schema.mediaSources);
			// Expect values to be called with the newMediaSource data
			expect(mockDrizzle.values).toHaveBeenCalledWith(newMediaSource);
			expect(mockDrizzle.returning).toHaveBeenCalled();
			expect(result).toEqual([fullMediaSource]);
		});
	});

	describe("updateMediaSource", () => {
		it("should call db.update().set().where().returning() with the correct data", async () => {
			mockDrizzle.returning.mockResolvedValueOnce([updatedMediaSource]); // Mock the return value
			const result = await updateMediaSource(
				fullMediaSource.id,
				updatedMediaSource,
			);
			expect(mockDrizzle.update).toHaveBeenCalledWith(schema.mediaSources);
			expect(mockDrizzle.set).toHaveBeenCalledWith(updatedMediaSource);
			expect(mockDrizzle.where).toHaveBeenCalledWith(
				eq(schema.mediaSources.id, fullMediaSource.id),
			);
			expect(mockDrizzle.returning).toHaveBeenCalled();
			expect(result).toEqual([updatedMediaSource]);
		});
	});

	describe("deleteMediaSource", () => {
		it("should call db.delete().where().returning() with the correct ID", async () => {
			mockDrizzle.returning.mockResolvedValueOnce([fullMediaSource]); // Mock the return value
			const result = await deleteMediaSource(fullMediaSource.id);
			expect(mockDrizzle.delete).toHaveBeenCalledWith(schema.mediaSources);
			expect(mockDrizzle.where).toHaveBeenCalledWith(
				eq(schema.mediaSources.id, fullMediaSource.id),
			);
			expect(mockDrizzle.returning).toHaveBeenCalled();
			expect(result).toEqual([fullMediaSource]);
		});
	});
});
