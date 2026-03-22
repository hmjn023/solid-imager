import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ServiceRegistry } from "~/application/registry";

describe("ServiceRegistry Unit Tests", () => {
	let registry: ServiceRegistry;

	beforeEach(() => {
		registry = ServiceRegistry.getInstance();
		vi.clearAllMocks();
	});

	describe("reset", () => {
		it("should clear all registered repositories and services", async () => {
			// Register mock repository
			const mockRepo = {} as any;
			registry.registerMediaRepository(mockRepo);

			// Verify it's registered
			expect(registry.getMediaRepository()).toBe(mockRepo);

			// Perform reset
			await registry.reset();

			// Verify it's cleared
			expect(() => registry.getMediaRepository()).toThrow(
				"MediaRepository has not been registered.",
			);
		});
	});
});
