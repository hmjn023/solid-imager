import { describe, expect, it } from "vitest";
import { toQueryUiState } from "./query-state";

describe("toQueryUiState", () => {
	it("maps an initial fetch to pending", () => {
		expect(
			toQueryUiState({
				data: undefined,
				status: "pending",
				fetchStatus: "fetching",
			}),
		).toMatchObject({ phase: "pending", fetchState: "idle" });
	});

	it("uses the caller empty predicate", () => {
		expect(
			toQueryUiState(
				{ data: [], status: "success", fetchStatus: "idle" },
				{ isEmpty: (data) => data.length === 0 },
			),
		).toMatchObject({ phase: "empty", fetchState: "idle" });
	});

	it("maps an initial error to error", () => {
		const error = new Error("failed");
		expect(
			toQueryUiState({
				data: undefined,
				error,
				status: "error",
				fetchStatus: "idle",
			}),
		).toEqual({
			phase: "error",
			fetchState: "idle",
			data: undefined,
			error,
		});
	});

	it("maps a paused initial fetch to offline", () => {
		expect(
			toQueryUiState({
				data: undefined,
				status: "pending",
				fetchStatus: "paused",
			}),
		).toMatchObject({ phase: "offline", fetchState: "paused" });
	});

	it("maps an unavailable network without data to offline", () => {
		expect(
			toQueryUiState(
				{
					data: undefined,
					status: "error",
					fetchStatus: "idle",
				},
				{ isOnline: false },
			),
		).toMatchObject({ phase: "offline", fetchState: "idle" });
	});

	it("preserves cached data during a background fetch", () => {
		expect(
			toQueryUiState({
				data: ["cached"],
				status: "success",
				fetchStatus: "fetching",
			}),
		).toMatchObject({
			phase: "data",
			fetchState: "background-fetching",
			data: ["cached"],
		});
	});

	it("preserves cached data and the refetch error", () => {
		const error = new Error("refetch failed");
		expect(
			toQueryUiState({
				data: ["cached"],
				error,
				status: "error",
				fetchStatus: "idle",
			}),
		).toEqual({
			phase: "data",
			fetchState: "idle",
			data: ["cached"],
			error,
		});
	});

	it("preserves cached data while paused", () => {
		expect(
			toQueryUiState({
				data: ["cached"],
				status: "success",
				fetchStatus: "paused",
			}),
		).toMatchObject({
			phase: "data",
			fetchState: "paused",
			data: ["cached"],
		});
	});

	it("preserves an empty result during a background fetch", () => {
		expect(
			toQueryUiState(
				{ data: [], status: "success", fetchStatus: "fetching" },
				{ isEmpty: (data) => data.length === 0 },
			),
		).toMatchObject({
			phase: "empty",
			fetchState: "background-fetching",
			data: [],
		});
	});

	it("preserves an empty cached result while paused", () => {
		expect(
			toQueryUiState(
				{ data: [], status: "success", fetchStatus: "paused" },
				{ isEmpty: (data) => data.length === 0 },
			),
		).toMatchObject({
			phase: "empty",
			fetchState: "paused",
			data: [],
		});
	});
});
