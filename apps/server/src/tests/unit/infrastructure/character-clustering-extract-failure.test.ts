import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	connect: vi.fn(),
	query: vi.fn(),
	end: vi.fn(),
	warn: vi.fn(),
	failManifest: false,
}));
vi.mock("pg", () => ({
	Client: class {
		connect = mocks.connect;
		query = mocks.query;
		end = mocks.end;
	},
}));
vi.mock("pino", () => ({
	default: Object.assign(() => ({ warn: mocks.warn }), {
		destination: () => undefined,
	}),
}));
vi.mock(
	"../../../../scripts/character-clustering/snapshot",
	async (importOriginal) => {
		const original =
			await importOriginal<
				typeof import("../../../../scripts/character-clustering/snapshot")
			>();
		return {
			...original,
			writeJson: async (file: string, value: object) => {
				if (
					mocks.failManifest &&
					"status" in value &&
					value.status === "failed"
				)
					throw new Error("manifest unavailable");
				await original.writeJson(file, value);
			},
		};
	},
);
import { extract } from "../../../../scripts/character-clustering/extract";

describe("clustering extraction failure cleanup", () => {
	let root: string;
	const failure = new Error("original extraction failure");
	beforeEach(async () => {
		vi.clearAllMocks();
		mocks.failManifest = false;
		mocks.connect.mockResolvedValue(undefined);
		mocks.end.mockRejectedValue(new Error("close failed"));
		mocks.query.mockImplementation(async (query: string) => {
			if (query.startsWith("BEGIN")) return {};
			if (query === "ROLLBACK") throw new Error("connection lost");
			throw failure;
		});
		root = await mkdtemp(path.join(tmpdir(), "clustering-failure-"));
	});
	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("marks the manifest failed even if rollback and close both fail", async () => {
		const output = path.join(root, "graph");
		await expect(extract(output, {})).rejects.toBe(failure);
		expect(
			JSON.parse(await readFile(path.join(output, "graph.json"), "utf8"))
				.status,
		).toBe("failed");
		expect(mocks.query).toHaveBeenCalledWith("ROLLBACK");
		expect(mocks.end).toHaveBeenCalledOnce();
		expect(mocks.warn).toHaveBeenCalledTimes(2);
	});

	it("preserves the original failure when every cleanup step fails", async () => {
		mocks.failManifest = true;
		await expect(extract(path.join(root, "graph"), {})).rejects.toBe(failure);
		expect(mocks.end).toHaveBeenCalledOnce();
		expect(mocks.warn).toHaveBeenCalledTimes(3);
	});
});
