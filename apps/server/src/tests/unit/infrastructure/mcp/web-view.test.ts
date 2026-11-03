import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterWebViewPaint } from "~/infrastructure/mcp/web-view";

describe("WebMCP paint completion", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn(() => 42),
		);
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("finishes in a background tab without animation frames", async () => {
		const controller = new AbortController();
		const remove = vi.spyOn(controller.signal, "removeEventListener");
		const completed = afterWebViewPaint(controller.signal);
		await vi.advanceTimersByTimeAsync(100);
		await expect(completed).resolves.toBeUndefined();
		expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
		expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
		expect(vi.getTimerCount()).toBe(0);
	});

	it("rejects cancellation and clears the pending fallback", async () => {
		const controller = new AbortController();
		const pending = afterWebViewPaint(controller.signal);
		const rejected = expect(pending).rejects.toThrow("stopped");
		controller.abort(new Error("stopped"));
		await rejected;
		expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("finishes after two frames and removes the fallback", async () => {
		const callbacks: FrameRequestCallback[] = [];
		vi.mocked(requestAnimationFrame).mockImplementation((callback) => {
			callbacks.push(callback);
			return callbacks.length;
		});
		const pending = afterWebViewPaint(new AbortController().signal);
		callbacks[0](0);
		callbacks[1](16);
		await expect(pending).resolves.toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
	});
});
