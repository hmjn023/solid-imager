import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToEventStream } from "./event-stream";

function createPageHideEvent(persisted: boolean): PageTransitionEvent {
	const event = new Event("pagehide") as PageTransitionEvent;
	Object.defineProperty(event, "persisted", { value: persisted });
	return event;
}

describe("subscribeToEventStream", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("stops an active stream before a non-BFCache page unload", async () => {
		const page = new EventTarget();
		vi.stubGlobal("window", page);
		const onError = vi.fn();
		let streamSignal: AbortSignal | undefined;
		const openStream = vi.fn(
			(signal: AbortSignal) =>
				new Promise<AsyncIterable<never>>((_, reject) => {
					streamSignal = signal;
					signal.addEventListener(
						"abort",
						() => reject(new Error("network error")),
						{ once: true },
					);
				}),
		);

		const unsubscribe = subscribeToEventStream(openStream, vi.fn(), onError);
		expect(streamSignal).toBeDefined();

		page.dispatchEvent(createPageHideEvent(false));
		expect(streamSignal?.aborted).toBe(true);
		await Promise.resolve();
		await Promise.resolve();

		expect(onError).not.toHaveBeenCalled();
		unsubscribe();
	});

	it("keeps an active stream for a BFCache pagehide event", () => {
		const page = new EventTarget();
		vi.stubGlobal("window", page);
		let streamSignal: AbortSignal | undefined;
		const openStream = vi.fn((signal: AbortSignal) => {
			streamSignal = signal;
			return new Promise<AsyncIterable<never>>(() => {});
		});

		const unsubscribe = subscribeToEventStream(openStream, vi.fn());
		page.dispatchEvent(createPageHideEvent(true));

		expect(streamSignal?.aborted).toBe(false);
		unsubscribe();
		expect(streamSignal?.aborted).toBe(true);
	});
});
