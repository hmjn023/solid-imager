import { describe, expect, it } from "vitest";
import {
	AiRequestAdmission,
	AI_MAX_BODY_BYTES,
	isAiInferenceRequest,
} from "~/infrastructure/ai/ai-request-admission";

describe("AI HTTP admission before body parsing", () => {
	it("caps retained requests and frees a reservation only once", async () => {
		const gate = new AiRequestAdmission(1);
		const first = gate.acquire("/api/rpc/ai/tag", "64");
		if (first instanceof Response) throw new Error("First request rejected");
		const busy = gate.acquire("/api/rpc/ai/ccipFeature", "64");
		if (!(busy instanceof Response)) throw new Error("Overflow admitted");
		expect(busy.status).toBe(429);
		expect(busy.headers.get("retry-after")).toBe("5");
		first();
		first();
		const second = gate.acquire("/api/rpc/ai/tag", "64");
		if (second instanceof Response) throw new Error("Capacity not restored");
		expect(gate.acquire("/api/rpc/ai/tag", "64")).toBeInstanceOf(Response);
		second();
	});
	it("rejects oversized declared bodies without allocating them", () => {
		const gate = new AiRequestAdmission();
		const denied = gate.acquire(
			"/api/rpc/ai/tag",
			String(AI_MAX_BODY_BYTES + 1),
		);
		if (!(denied instanceof Response))
			throw new Error("Oversized request admitted");
		expect(denied.status).toBe(413);
	});
	it("preserves health, job management and unrelated large uploads", () => {
		const gate = new AiRequestAdmission(0);
		for (const url of [
			"/api/rpc/ai/health",
			"/api/rpc/ai/startBatchTagging",
			"/api/rpc/jobs/cancel",
			"/api/rpc/media/upload",
		]) {
			expect(isAiInferenceRequest(url)).toBe(false);
			const admission = gate.acquire(url, String(AI_MAX_BODY_BYTES * 2));
			if (admission instanceof Response)
				throw new Error("Unrelated request rejected");
			admission();
		}
		expect(
			isAiInferenceRequest("http://localhost/api/rpc/%61i/%74ag?x=1"),
		).toBe(true);
	});
});
