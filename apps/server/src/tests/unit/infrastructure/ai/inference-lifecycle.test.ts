import { expect, it, vi } from "vitest";
import { InferenceLifecycle } from "~/infrastructure/ai/inference-lifecycle";

it("drains concurrent users before switching models and releases the final session once", async () => {
	const order: string[] = [];
	const lifecycle = new InferenceLifecycle(async () => {
		order.push("offload");
	});
	const gate = Promise.withResolvers<void>();
	const tag = () =>
		lifecycle.run("tagging", async () => {
			order.push("tag");
			await gate.promise;
		});
	const a = tag(),
		b = tag();
	const embedding = lifecycle.run("embedding", async () => {
		order.push("embed");
	});
	const clean = lifecycle.offload();
	await vi.waitFor(() => expect(order).toEqual(["tag", "tag"]));
	gate.resolve();
	await Promise.all([a, b, embedding, clean]);
	await lifecycle.offload();
	expect(order).toEqual(["tag", "tag", "offload", "embed", "offload"]);
});

it("blocks the next model on a failed release and can retry", async () => {
	const release = vi
		.fn()
		.mockRejectedValueOnce(new Error("release"))
		.mockResolvedValue(undefined);
	const lifecycle = new InferenceLifecycle(release);
	await lifecycle.run("ccip", async () => {});
	const next = vi.fn();
	await expect(lifecycle.run("tagging", next)).rejects.toThrow("release");
	expect(next).not.toHaveBeenCalled();
	await lifecycle.run("tagging", next);
	expect(next).toHaveBeenCalledOnce();
});
