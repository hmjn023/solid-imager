import { describe, expect, it } from "vitest";
import {
	buildNeighborGraph,
	fitSparseHdbscan,
	type SparseDistanceGraph,
} from "@solid-imager/application/utils/sparse-hdbscan";

function graphFromDistances(matrix: number[][]): SparseDistanceGraph {
	const offsets = [0];
	const indices: number[] = [];
	const distances: number[] = [];
	for (let i = 0; i < matrix.length; i++) {
		for (let j = 0; j < matrix.length; j++)
			if (i !== j && Number.isFinite(matrix[i][j])) {
				indices.push(j);
				distances.push(Math.max(matrix[i][j], 1e-12));
			}
		offsets.push(indices.length);
	}
	return {
		pointCount: matrix.length,
		offsets: Int32Array.from(offsets),
		indices: Int32Array.from(indices),
		distances: Float64Array.from(distances),
	};
}

function groups(labels: Int32Array) {
	const result = new Map<number, number[]>();
	for (let i = 0; i < labels.length; i++)
		if (labels[i] >= 0) {
			const group = result.get(labels[i]) ?? [];
			group.push(i);
			result.set(labels[i], group);
		}
	return [...result.values()].sort((a, b) => a[0] - b[0]);
}

const options = {
	minClusterSize: 3,
	minSamples: 1,
	selectionMethod: "eom" as const,
};

describe("sparse HDBSCAN", () => {
	it("finds two dense groups and leaves a distant point as noise", () => {
		const matrix = Array.from({ length: 9 }, (_, i) =>
			Array.from({ length: 9 }, (_, j) =>
				i === 8 || j === 8
					? 2
					: Math.floor(i / 4) === Math.floor(j / 4)
						? 0.1
						: 1,
			),
		);
		const result = fitSparseHdbscan(graphFromDistances(matrix), options);
		expect(groups(result.labels)).toEqual([
			[0, 1, 2, 3],
			[4, 5, 6, 7],
		]);
		expect(result.labels[8]).toBe(-1);
		expect([...result.membershipStrengths]).toEqual([
			1, 1, 1, 1, 1, 1, 1, 1, 0,
		]);
		for (const persistence of result.persistence)
			expect(persistence).toBeCloseTo(0.9, 10);
	});

	it("selects parent groups with EOM and finer stable leaves with leaf selection", () => {
		const matrix = Array.from({ length: 12 }, (_, i) =>
			Array.from({ length: 12 }, (_, j) => {
				const group = Math.floor(i / 4);
				if (group !== Math.floor(j / 4)) return 1;
				return Math.floor(i / 2) === Math.floor(j / 2)
					? 0.1 * (group + 1)
					: 0.1 * (group + 1) + 0.01;
			}),
		);
		const graph = graphFromDistances(matrix);
		expect(
			groups(fitSparseHdbscan(graph, { ...options, minClusterSize: 2 }).labels),
		).toEqual([
			[0, 1, 2, 3],
			[4, 5, 6, 7],
			[8, 9, 10, 11],
		]);
		expect(
			groups(
				fitSparseHdbscan(graph, {
					...options,
					minClusterSize: 2,
					selectionMethod: "leaf",
				}).labels,
			),
		).toEqual([
			[0, 1],
			[2, 3],
			[4, 5],
			[6, 7],
			[8, 9],
			[10, 11],
		]);
		expect(
			groups(
				fitSparseHdbscan(graph, {
					...options,
					minClusterSize: 2,
					minSamples: 3,
				}).labels,
			),
		).toEqual([
			[0, 1, 2, 3],
			[4, 5, 6, 7],
			[8, 9, 10, 11],
		]);
	});

	it("keeps disconnected component labels distinct and small components as noise", () => {
		const matrix = Array.from({ length: 18 }, (_, i) =>
			Array.from({ length: 18 }, (_, j) => {
				if (Math.floor(i / 8) !== Math.floor(j / 8)) return Infinity;
				return Math.floor(i / 4) === Math.floor(j / 4) ? 0.1 : 1;
			}),
		);
		const result = fitSparseHdbscan(graphFromDistances(matrix), options);
		expect(groups(result.labels)).toEqual([
			[0, 1, 2, 3],
			[4, 5, 6, 7],
			[8, 9, 10, 11],
			[12, 13, 14, 15],
		]);
		expect(result.labels.slice(16)).toEqual(Int32Array.of(-1, -1));
		expect(result.componentSizes).toEqual([8, 8, 2]);
	});

	it("does not classify an entire indivisible root as one character", () => {
		const graph = graphFromDistances(
			Array.from({ length: 6 }, () => Array(6).fill(0.1)),
		);
		expect([...fitSparseHdbscan(graph, options).labels]).toEqual(
			Array(6).fill(-1),
		);
	});

	it("rejects insufficient observed neighbors instead of inventing distances", () => {
		const matrix = Array.from({ length: 6 }, (_, i) =>
			Array.from({ length: 6 }, (_, j) =>
				i === 0 || j === 0 ? 0.1 : Infinity,
			),
		);
		expect(() =>
			fitSparseHdbscan(graphFromDistances(matrix), {
				...options,
				minSamples: 3,
			}),
		).toThrow("fewer than minSamples");
	});

	it("preserves zero-distance observations and merges reciprocal edges without summing", () => {
		const graph = buildNeighborGraph(
			Int32Array.of(1, 2, 0, 2, 1, 0),
			Float64Array.of(0, 0.4, 0, 0.3, 0.3, 0.4),
			3,
			2,
			2,
		);
		expect([...graph.offsets]).toEqual([0, 2, 4, 6]);
		expect([...graph.distances]).toEqual([1e-12, 0.4, 1e-12, 0.3, 0.4, 0.3]);
	});

	it("rejects duplicate, self, missing, unsorted and invalid neighbor data", () => {
		for (const data of [
			{
				indices: [1, 1, 0, 2, 0, 1],
				distances: [0.1, 0.2, 0.1, 0.2, 0.1, 0.2],
			},
			{
				indices: [0, 2, 0, 2, 0, 1],
				distances: [0.1, 0.2, 0.1, 0.2, 0.1, 0.2],
			},
			{
				indices: [-1, 2, 0, 2, 0, 1],
				distances: [0.1, 0.2, 0.1, 0.2, 0.1, 0.2],
			},
			{
				indices: [1, 2, 0, 2, 0, 1],
				distances: [0.2, 0.1, 0.1, 0.2, 0.1, 0.2],
			},
			{
				indices: [1, 2, 0, 2, 0, 1],
				distances: [NaN, 0.2, 0.1, 0.2, 0.1, 0.2],
			},
		])
			expect(() =>
				buildNeighborGraph(
					Int32Array.from(data.indices),
					Float64Array.from(data.distances),
					3,
					2,
					2,
				),
			).toThrow();
	});

	it("handles a deep chain iteratively without quadratic cluster membership storage", () => {
		const n = 5000;
		const offsets = new Int32Array(n + 1);
		const columns: number[] = [];
		for (let i = 0; i < n; i++) {
			if (i > 0) columns.push(i - 1);
			if (i < n - 1) columns.push(i + 1);
			offsets[i + 1] = columns.length;
		}
		const graph = {
			pointCount: n,
			offsets,
			indices: Int32Array.from(columns),
			distances: new Float64Array(columns.length).fill(1),
		};
		expect(
			fitSparseHdbscan(graph, options).labels.every((label) => label === -1),
		).toBe(true);
	});
});
