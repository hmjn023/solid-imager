import { describe, expect, it, vi } from "vitest";
import { mutateSelectedJobs } from "./jobs-mutations";

describe("selected job actions", () => {
	it("runs cancellation sequentially and keeps partial failures without repeating IDs", async () => {
		let active = 0;
		let peak = 0;
		const cancel = vi.fn(async ({ id }: { id: string }) => {
			active++;
			peak = Math.max(peak, active);
			await Promise.resolve();
			active--;
			if (id === "failure") throw new Error("Job changed state");
		});
		const result = await mutateSelectedJobs(
			{ cancel, retry: vi.fn(), delete: vi.fn() },
			"cancel",
			["one", "failure", "one", "two"],
		);
		expect(result).toEqual({ succeeded: 2, failed: ["failure"] });
		expect(peak).toBe(1);
		expect(cancel.mock.calls.map(([input]) => input.id)).toEqual([
			"one",
			"failure",
			"two",
		]);
	});
});
