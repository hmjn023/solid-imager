import { StaleMediaRegionError } from "@solid-imager/core/domain/errors";
import { describe, expect, it, vi } from "vite-plus/test";
import {
	handleMediaRegionRenderRequest,
	type MediaRegionRenderService,
} from "~/infrastructure/api/media-region-render-handler";

const REGION_ID = "10000000-0000-4000-8000-000000000001";
const REVISION = "a".repeat(64);
const ETAG = `"${"b".repeat(64)}"`;

function createService(): MediaRegionRenderService {
	return {
		getRenderIdentity: vi.fn(async () => ({ etag: ETAG })),
		render: vi.fn(async () => ({
			bytes: new Uint8Array([1, 2, 3]),
			format: "webp" as const,
			width: 1,
			height: 1,
		})),
	};
}

describe("handleMediaRegionRenderRequest", () => {
	it("returns 304 without invoking the renderer when the ETag matches", async () => {
		const service = createService();
		const response = await handleMediaRegionRenderRequest(
			new Request(
				`http://localhost/api/media-regions/${REGION_ID}/render?revision=${REVISION}&transparent=true`,
				{ headers: { "If-None-Match": ETAG } },
			),
			REGION_ID,
			service,
		);

		expect(response.status).toBe(304);
		expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
		expect(response.headers.get("ETag")).toBe(ETAG);
		expect(service.getRenderIdentity).toHaveBeenCalledWith(
			REGION_ID,
			REVISION,
			{
				transparent: true,
			},
		);
		expect(service.render).not.toHaveBeenCalled();
	});

	it("maps stale source revisions to HTTP 409", async () => {
		const service = createService();
		vi.mocked(service.getRenderIdentity).mockRejectedValueOnce(
			new StaleMediaRegionError(REGION_ID),
		);
		const response = await handleMediaRegionRenderRequest(
			new Request(
				`http://localhost/api/media-regions/${REGION_ID}/render?revision=${REVISION}`,
			),
			REGION_ID,
			service,
		);

		expect(response.status).toBe(409);
		expect(service.render).not.toHaveBeenCalled();
	});

	it("rejects untrusted revision strings before creating response headers", async () => {
		const service = createService();
		const response = await handleMediaRegionRenderRequest(
			new Request(
				`http://localhost/api/media-regions/${REGION_ID}/render?revision=bad%22%0d%0aX-Test%3Ayes`,
			),
			REGION_ID,
			service,
		);

		expect(response.status).toBe(400);
		expect(service.getRenderIdentity).not.toHaveBeenCalled();
		expect(response.headers.get("X-Test")).toBeNull();
	});
});
