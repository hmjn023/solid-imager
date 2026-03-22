import { describe, expect, it, vi } from "vite-plus/test";
import { eventService } from "~/application/services/event-service";

describe("EventService", () => {
	it("should create an SSE stream and enqueue events", () => {
		// Mock controller
		const mockController = {
			enqueue: vi.fn(),
			close: vi.fn(),
		};

		// Capture the start callback

		let startCallback: ((controller: any) => void) | undefined;

		// Mock global ReadableStream
		const MockReadableStream = vi.fn(function (strategies: any) {
			startCallback = strategies.start;
			return {};
		});
		vi.stubGlobal("ReadableStream", MockReadableStream);

		// Mock global Response
		const MockResponse = vi.fn(function (body: any, init: any) {
			return { body, init };
		});
		vi.stubGlobal("Response", MockResponse);

		const mockSignal = {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			aborted: false,
		};
		const mockRequest = { signal: mockSignal };
		const mockEvent = { request: mockRequest };

		// 1. Create Stream

		eventService.createSseStream(mockEvent as any);

		if (!startCallback) {
			throw new Error("startCallback is not defined");
		}

		// 2. Initialize controller
		startCallback(mockController);

		// 3. Emit event
		const payload = { mediaId: "test-media-id" };
		eventService.sendSseEvent("media:updated", payload);

		expect(mockController.enqueue).toHaveBeenCalledWith(
			expect.stringContaining(JSON.stringify(payload)),
		);

		vi.unstubAllGlobals();
	});

	it("should not enqueue if signal is aborted", () => {
		// Mock controller
		const mockController = {
			enqueue: vi.fn(),
			close: vi.fn(),
		};

		let startCallback: ((controller: any) => void) | undefined;

		const MockReadableStream = vi.fn(function (strategies: any) {
			startCallback = strategies.start;
			return {};
		});
		vi.stubGlobal("ReadableStream", MockReadableStream);

		// Mock global Response
		const MockResponse = vi.fn(function (body: any, init: any) {
			return { body, init };
		});
		vi.stubGlobal("Response", MockResponse);

		const mockSignal = {
			addEventListener: vi.fn(),
			aborted: true, // Aborted!
		};
		const mockEvent = { request: { signal: mockSignal } };

		eventService.createSseStream(mockEvent as any);

		if (!startCallback) {
			throw new Error("startCallback is not defined");
		}
		startCallback(mockController);

		// Emit event
		eventService.sendSseEvent("media:updated", { mediaId: "foo" });

		// Should NOT call enqueue
		expect(mockController.enqueue).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});

	it("should handle controller error (closed) gracefully", () => {
		// Mock controller
		const mockController = {
			enqueue: vi.fn().mockImplementation(() => {
				throw new Error("Controller is already closed");
			}),
			close: vi.fn(),
		};

		let startCallback: ((controller: any) => void) | undefined;
		const MockReadableStream = vi.fn(function (strategies: any) {
			startCallback = strategies.start;
			return {};
		});
		vi.stubGlobal("ReadableStream", MockReadableStream);

		// Mock global Response
		const MockResponse = vi.fn(function (body: any, init: any) {
			return { body, init };
		});
		vi.stubGlobal("Response", MockResponse);

		const mockSignal = {
			addEventListener: vi.fn(),
			aborted: false,
		};
		const mockEvent = { request: { signal: mockSignal } };

		eventService.createSseStream(mockEvent as any);

		if (!startCallback) {
			throw new Error("startCallback is not defined");
		}
		startCallback(mockController);

		// Emit event -> should throw internally but be caught
		expect(() => {
			eventService.sendSseEvent("media:updated", { mediaId: "foo" });
		}).not.toThrow();

		// Enqueue was called (and failed)
		expect(mockController.enqueue).toHaveBeenCalled();

		// Verify listener is removed
		mockController.enqueue.mockClear();
		eventService.sendSseEvent("media:updated", { mediaId: "bar" });
		expect(mockController.enqueue).not.toHaveBeenCalled();

		vi.unstubAllGlobals();
	});
});
