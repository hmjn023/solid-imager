import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

function storage(initial: Record<string, unknown>) {
	const stored = structuredClone(initial);
	const set = vi.fn(async (value: object) => {
		Object.assign(stored, structuredClone(value));
	});
	vi.stubGlobal("chrome", {
		storage: {
			local: {
				get: vi.fn(async () => structuredClone(stored)),
				set,
			},
		},
	});
	return { stored, set };
}

describe("server scoped extension settings", () => {
	it("adopts the legacy selection only for its saved server and preserves it across URL edits", async () => {
		const apiUrl = "https://old.example";
		storage({ apiUrl: `${apiUrl}/api/rpc`, selectedSourceId: "legacy-source" });
		const { readConnectionSettings, updateConnectionSettings } =
			await import("./connection-settings");
		expect(await readConnectionSettings()).toEqual({
			apiUrl,
			generation: 0,
			selectedSourceIds: { [apiUrl]: "legacy-source" },
		});
		await updateConnectionSettings((current) => ({
			...current,
			apiUrl: "https://new.example",
			generation: current.generation + 1,
		}));
		const next = await readConnectionSettings();
		expect(next.selectedSourceIds[next.apiUrl]).toBeUndefined();
		expect(next.selectedSourceIds[apiUrl]).toBe("legacy-source");
	});

	it("migrates stored endpoint URLs and selections together", async () => {
		const apiUrl = "https://old.example/imager";
		const other = "https://other.example";
		const { set } = storage({
			connectionSettings: {
				apiUrl: `${apiUrl}/api/rpc/`,
				generation: 4,
				selectedSourceIds: {
					[`${apiUrl}/api/rpc/`]: "active-source",
					[`${other}/api/rpc`]: "older-source",
					[other]: "saved-source",
					"https://separate.example/api/rpc/path": "separate-source",
				},
			},
		});
		const { readConnectionSettings, updateConnectionSettings } =
			await import("./connection-settings");
		const expected = {
			apiUrl,
			generation: 4,
			selectedSourceIds: {
				[apiUrl]: "active-source",
				[other]: "saved-source",
				"https://separate.example/api/rpc/path": "separate-source",
			},
		};
		expect(await readConnectionSettings()).toEqual(expected);
		expect(set).not.toHaveBeenCalled();
		await updateConnectionSettings((current) => current);
		expect(set).toHaveBeenCalledWith({ connectionSettings: expected });
	});

	it("serializes rapid updates and resumes after a failed storage write", async () => {
		const { set } = storage({});
		const { readConnectionSettings, updateConnectionSettings } =
			await import("./connection-settings");
		set.mockRejectedValueOnce(new Error("storage unavailable"));
		const change = (await readConnectionSettings()).apiUrl;
		await expect(
			updateConnectionSettings((current) => ({ ...current, generation: 1 })),
		).rejects.toThrow("storage unavailable");
		await Promise.all([
			updateConnectionSettings((current) => ({
				...current,
				generation: current.generation + 1,
				selectedSourceIds: { ...current.selectedSourceIds, [change]: "a" },
			})),
			updateConnectionSettings((current) => ({
				...current,
				generation: current.generation + 1,
				selectedSourceIds: {
					...current.selectedSourceIds,
					"https://other.example": "b",
				},
			})),
		]);
		expect(await readConnectionSettings()).toMatchObject({
			generation: 2,
			selectedSourceIds: {
				[change]: "a",
				"https://other.example": "b",
			},
		});
	});

	it("rejects corrupt persisted settings instead of silently using another destination", async () => {
		storage({
			connectionSettings: {
				apiUrl: "not-a-url",
				generation: 2,
				selectedSourceIds: {},
			},
		});
		const { readConnectionSettings } = await import("./connection-settings");
		await expect(readConnectionSettings()).rejects.toThrow();
	});
});
