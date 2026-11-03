import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createSharedEventSubscription,
	subscribeToEventStream,
} from "./event-stream";

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
						{
							once: true,
						},
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

	it("notifies after the stream connection is ready", async () => {
		let resolveConnected!: () => void;
		const connected = new Promise<void>((resolve) => {
			resolveConnected = resolve;
		});
		const onConnected = vi.fn(resolveConnected);
		const openStream = vi.fn(async () => ({
			async *[Symbol.asyncIterator]() {
				yield* [];
			},
		}));

		const unsubscribe = subscribeToEventStream(
			openStream,
			vi.fn(),
			undefined,
			onConnected,
		);
		await connected;

		expect(onConnected).toHaveBeenCalledOnce();
		unsubscribe();
	});
});

it("shares the inbox stream with late subscribers until the last indicator unmounts", async () => {
	const open = vi.fn(async (signal: AbortSignal) => ({
		async *[Symbol.asyncIterator]() {
			yield 1;
			await new Promise<void>((resolve) =>
				signal.addEventListener("abort", () => resolve(), { once: true }),
			);
		},
	}));
	const subscribe = createSharedEventSubscription(open);
	const firstEvent = vi.fn();
	const stopFirst = subscribe(firstEvent);
	await vi.waitFor(() => expect(firstEvent).toHaveBeenCalledWith(1));
	const connected = vi.fn();
	const stopSecond = subscribe(vi.fn(), connected);
	expect(connected).toHaveBeenCalledOnce();
	expect(open).toHaveBeenCalledOnce();
	const signal = open.mock.calls[0][0];
	stopFirst();
	expect(signal.aborted).toBe(false);
	stopSecond();
	expect(signal.aborted).toBe(true);
});
