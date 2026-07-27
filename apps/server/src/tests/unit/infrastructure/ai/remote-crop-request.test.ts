import { describe, expect, it } from "vite-plus/test";
import { createRemoteCropRequest } from "~/infrastructure/ai/remote-crop-request";

describe("createRemoteCropRequest", () => {
	it("forwards the transparent render choice to the remote AI request", () => {
		const request = createRemoteCropRequest(
			new Uint8Array([1, 2, 3]),
			"source.png",
			true,
		);

		expect(request.transparent).toBe(true);
		expect(request.file.name).toBe("source.png");
		expect(request.file.size).toBe(3);
	});
});
