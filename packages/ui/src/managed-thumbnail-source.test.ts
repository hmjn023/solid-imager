import { describe, expect, it, vi } from "vitest";
import { createManagedThumbnailSource } from "./managed-thumbnail-source";

describe("managed thumbnail URLs", () => {
	it("keeps synchronous web URLs usable without a release callback", () => {
		const managed = createManagedThumbnailSource("/thumbnail/image");
		expect(managed.source.getUrl()).toBe("/thumbnail/image");
		managed.dispose();
	});

	it("shares one resolved URL across reads and releases it once", async () => {
		const release = vi.fn();
		const managed = createManagedThumbnailSource(
			Promise.resolve("blob:image"),
			release,
		);
		expect(managed.source.getUrl()).toBe(managed.source.getUrl());
		expect(await managed.source.getUrl()).toBe("blob:image");
		expect(release).not.toHaveBeenCalled();
		managed.dispose();
		managed.dispose();
		expect(release).toHaveBeenCalledExactlyOnceWith("blob:image");
	});

	it("releases a late response after the image is removed", async () => {
		const release = vi.fn();
		const response = Promise.withResolvers<string>();
		const managed = createManagedThumbnailSource(response.promise, release);
		managed.dispose();
		response.resolve("blob:late");
		expect(await managed.source.getUrl()).toBe("");
		expect(release).toHaveBeenCalledExactlyOnceWith("blob:late");
		managed.dispose();
		expect(release).toHaveBeenCalledTimes(1);
	});

	it("exposes request failures to the shared image fallback", async () => {
		const release = vi.fn();
		const failure = new Error("HTTP 503");
		const managed = createManagedThumbnailSource(
			Promise.reject(failure),
			release,
		);
		await expect(managed.source.getUrl()).rejects.toBe(failure);
		managed.dispose();
		expect(release).not.toHaveBeenCalled();
	});
});
