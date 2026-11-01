import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceRegistry } from "~/infrastructure/service-registry";

vi.mock("~/infrastructure/services/media-service", () => {
	throw new Error("Resetting the registry must not load concrete services");
});

describe("ServiceRegistry Unit Tests", () => {
	let registry: ServiceRegistry;

	beforeEach(() => {
		registry = ServiceRegistry.getInstance();
		vi.clearAllMocks();
	});

	describe("reset", () => {
		it("should clear registrations without loading concrete services", () => {
			// Register mock repository
			const mockRepo = {} as any;
			registry.registerMediaRepository(mockRepo);

			// Verify it's registered
			expect(registry.getMediaRepository()).toBe(mockRepo);

			// Perform reset
			registry.reset();

			// Verify it's cleared
			expect(() => registry.getMediaRepository()).toThrow(
				"MediaRepository has not been registered.",
			);
		});
	});
});
