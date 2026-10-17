import { describe, expect, it } from "vitest";
import { toQueryUiState } from "./query-state";

describe("toQueryUiState", () => {
	it("does not read Solid Query's suspending data getter while the initial request is pending", () => {
		expect(
			toQueryUiState({
				get data(): undefined {
					throw new Error("Pending data suspended the route");
				},
				status: "pending",
				fetchStatus: "fetching",
			}),
		).toMatchObject({ phase: "pending", data: undefined });
	});
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

	it("normalizes a successful query's null error", () => {
		expect(
			toQueryUiState({
				data: ["source"],
				error: null,
				status: "success",
				fetchStatus: "idle",
			}),
		).toEqual({
			phase: "data",
			fetchState: "idle",
			data: ["source"],
			error: undefined,
		});
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
