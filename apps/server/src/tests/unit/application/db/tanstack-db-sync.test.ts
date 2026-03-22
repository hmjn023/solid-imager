import type { Preset } from "@solid-imager/core/domain/media/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalDb } from "~/application/db/local-db";
import { SyncManager } from "~/application/db/sync-manager";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

// Use vi.hoisted to declare the variable before vi.mock
const mocks = vi.hoisted(() => ({
	capturedQueryFn: undefined as any,
}));

// Mock TanStack DB and query collection options
vi.mock("@tanstack/solid-db", () => ({
	createCollection: vi.fn((options) => options),
}));

vi.mock("@tanstack/query-db-collection", async (importOriginal) => {
	const actual = (await importOriginal()) as any;
	return {
		...actual,
		queryCollectionOptions: vi.fn((options) => {
			mocks.capturedQueryFn = options.queryFn;
			return options;
		}),
	};
});

// Mock dependencies
vi.mock("@electric-sql/pglite", () => ({
	PGlite: vi.fn().mockImplementation(() => ({
		waitReady: Promise.resolve(),
		query: vi.fn().mockResolvedValue({ rows: [] }),
		close: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock("~/infrastructure/api-clients/orpc-client", () => ({
	orpc: {
		presets: {
			list: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
	},
}));

vi.mock("~/infrastructure/logger", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
	updateLogLevel: vi.fn(),
}));

vi.mock("~/application/db/local-db", () => ({
	getLocalDb: vi.fn().mockResolvedValue({
		waitReady: Promise.resolve(),
		query: vi.fn().mockResolvedValue({ rows: [] }),
	}),
}));

describe("TanStack DB Sync Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("local-db.ts schema initialization logic", () => {
		it("should be called by SyncManager", async () => {
			await SyncManager.init();
			expect(getLocalDb).toHaveBeenCalled();
		});
	});

	describe("presets-collection.ts: queryFn", () => {
		it("should perform bulk upsert when fetching presets", async () => {
			const mockPresets: Preset[] = [
				{
					id: 1,
					name: "Preset 1",
					value: { key: "val1" } as any,
					sort: "date",
					order: "asc",
					mode: "simple",
					createdAt: new Date(),
				},
				{
					id: 2,
					name: "Preset 2",
					value: { key: "val2" } as any,
					sort: "name",
					order: "desc",
					mode: "pro",
					createdAt: new Date(),
				},
			];

			(orpc.presets.list as any).mockResolvedValue(mockPresets);

			// Verify capturedQueryFn is defined
			expect(mocks.capturedQueryFn).toBeDefined();

			const result = await mocks.capturedQueryFn();

			expect(result).toEqual(mockPresets);
			expect(orpc.presets.list).toHaveBeenCalled();

			const db = await getLocalDb();
			expect(db.query).toHaveBeenCalledWith("BEGIN");

			// Verify UNNEST query
			expect(db.query).toHaveBeenCalledWith(
				expect.stringContaining(
					"INSERT INTO presets (id, name, value, sort, display_order, mode, created_at)",
				),
				expect.arrayContaining([
					[1, 2], // ids
					["Preset 1", "Preset 2"], // names
				]),
			);

			expect(db.query).toHaveBeenCalledWith("COMMIT");
		});
	});

	describe("sync-manager.ts", () => {
		it("should orchestrate sync process correctly", async () => {
			await SyncManager.init();
			expect(getLocalDb).toHaveBeenCalled();
		});
	});
});
