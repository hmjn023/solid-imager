import { describe, expect, it, vi } from "vitest";
import { createMediaPreviewSelectHandler } from "./media-preview-selection";

describe("createMediaPreviewSelectHandler", () => {
	it("keeps preview selection absent for legacy collections", () => {
		expect(createMediaPreviewSelectHandler({ id: "media-1" })).toBeUndefined();
	});

	it("binds the selected media for inspector-enabled collections", () => {
		const media = { id: "media-1" };
		const onPreviewSelect = vi.fn();
		const handler = createMediaPreviewSelectHandler(media, onPreviewSelect);

		handler?.();

		expect(onPreviewSelect).toHaveBeenCalledOnce();
		expect(onPreviewSelect).toHaveBeenCalledWith(media);
	});
});
