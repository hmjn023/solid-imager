import { describe, expect, it } from "vitest";
import {
	AiInferenceBusyError,
	NativeInferenceGate,
} from "~/infrastructure/ai/native-inference-gate";

function latch() {
	let release = () => {};
	const wait = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { wait, release };
}

describe("native inference resource gate", () => {
	it("bounds waiters and keeps capacity until an abandoned caller's native task ends", async () => {
		const gate = new NativeInferenceGate(1);
		const running = latch();
		let secondStarted = false;
		const first = gate.run(() => running.wait);
		const second = gate.run(async () => {
			secondStarted = true;
			return "second";
		});
		await expect(gate.run(async () => "overflow")).rejects.toBeInstanceOf(
			AiInferenceBusyError,
		);
		// A caller ceasing to await the first request must not free its native slot.
		expect(secondStarted).toBe(false);
		running.release();
		await first;
		expect(await second).toBe("second");
		expect(await gate.run(async () => "recovered")).toBe("recovered");
	});
	it("releases capacity on both synchronous throws and rejected inference", async () => {
		const gate = new NativeInferenceGate(0);
		await expect(
			gate.run(() => {
				throw new Error("sync");
			}),
		).rejects.toThrow("sync");
		await expect(
			gate.run(async () => {
				throw new Error("async");
			}),
		).rejects.toThrow("async");
		expect(await gate.run(() => 42)).toBe(42);
	});
	it("never overlaps different model calls in a burst", async () => {
		const gate = new NativeInferenceGate(8);
		let active = 0;
		let peak = 0;
		await Promise.all(
			Array.from({ length: 8 }, (_, index) =>
				gate.run(async () => {
					active++;
					peak = Math.max(peak, active);
					await Promise.resolve();
					active--;
					return index;
				}),
			),
		);
		expect(peak).toBe(1);
	});
});
