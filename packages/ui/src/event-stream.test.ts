import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { subscribeToEventStream } from "./event-stream";

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("subscribeToEventStream", () => {
	it("keeps retrying when the error handler throws", async () => {
		vi.useFakeTimers();
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const openStream = vi.fn(async () => {
			throw new Error("stream failed");
		});
		const unsubscribe = subscribeToEventStream(
			openStream,
			() => undefined,
			() => {
				throw new Error("handler failed");
			},
		);

		await vi.waitFor(() => expect(openStream).toHaveBeenCalledOnce());
		await vi.advanceTimersByTimeAsync(1_000);

		expect(openStream).toHaveBeenCalledTimes(2);
		unsubscribe();
	});
});
