import { describe, expect, it } from "vitest";
import {
	decodeNpy,
	encodeNpy,
} from "../../../../scripts/character-clustering/snapshot";
import { adjustedRand } from "../../../../scripts/character-clustering/compare";
import {
	containsIndex,
	eligibility,
	neighborQuery,
} from "../../../../scripts/character-clustering/extract";

describe("character clustering snapshot interoperability", () => {
	it("round trips int32 and float64 arrays without a Python runtime", () => {
		for (const values of [
			Int32Array.of(0, 1, 2, 3, 4, 5),
			Float64Array.of(0, 0.1, 0.2, 0.3, 0.4, 0.5),
		]) {
			const result = decodeNpy(encodeNpy(values, 2, 3));
			expect([result.rows, result.columns]).toEqual([2, 3]);
			expect([...result.values]).toEqual([...values]);
		}
	});
	it("rejects malformed and truncated numeric files", () => {
		const good = encodeNpy(Float64Array.of(0, 1), 1, 2);
		expect(() => decodeNpy(good.subarray(0, good.length - 1))).toThrow();
		expect(() => decodeNpy(Buffer.from("arbitrary input"))).toThrow();
		expect(() => encodeNpy(Int32Array.of(1), 2, 2)).toThrow();
	});
	it("compares partitions independent of run-local label numbering", () => {
		expect(adjustedRand([0, 0, 1, 1, -1], [5, 5, 7, 7, -1])).toBe(1);
		expect(adjustedRand([0, 0, 1, 1], [0, 1, 0, 1])).toBeCloseTo(-0.5, 14);
		expect(adjustedRand([-1, -1], [-1, -1])).toBe(1);
		expect(() => adjustedRand([0], [0, 1])).toThrow();
	});
	it("keeps HNSW ordering and global candidates despite anchor batching", () => {
		const scope = eligibility(true);
		const query = neighborQuery(scope.condition, scope.parameters.length);
		expect(query).toContain("ORDER BY e.embedding <=> a.embedding LIMIT $3");
		expect(query).toContain("a.id=ANY($4::uuid[])");
		expect(query).not.toContain("e.id=ANY");
		expect(query).toContain("(SELECT EXISTS");
		expect(
			neighborQuery(scope.condition, scope.parameters.length, true),
		).toContain("(e.embedding <=> a.embedding)+0");
		expect(
			containsIndex([
				{
					Plan: {
						Plans: [{ "Index Name": "idx_ccip_embeddings_embedding_cosine" }],
					},
				},
			]),
		).toBe(true);
		expect(containsIndex([{ Plan: { "Node Type": "Seq Scan" } }])).toBe(false);
	});
});
