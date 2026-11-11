import { describe, expect, it } from "vitest";
import { createMediaFileResponse } from "~/infrastructure/http/media-file-response";

const fixture = new Blob(["0123456789"], { type: "video/mp4" });

function request(headers: HeadersInit = {}, method = "GET") {
	return new Request("http://localhost/api/sources/source/media", {
		method,
		headers,
	});
}

describe("media file HTTP responses", () => {
	it("streams a complete representation with its MIME type and byte length", async () => {
		const response = createMediaFileResponse(request(), fixture, "video/mp4");
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("video/mp4");
		expect(response.headers.get("Content-Length")).toBe("10");
		expect(response.headers.get("Accept-Ranges")).toBe("bytes");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.text()).toBe("0123456789");
	});

	it.each([
		["bytes=0-3", "0123", "bytes 0-3/10"],
		["Bytes=0-3", "0123", "bytes 0-3/10"],
		["bytes=7-", "789", "bytes 7-9/10"],
		["bytes=-3", "789", "bytes 7-9/10"],
		["bytes=7-100", "789", "bytes 7-9/10"],
		["bytes=-100", "0123456789", "bytes 0-9/10"],
	])("serves the requested range %s", async (range, body, contentRange) => {
		const response = createMediaFileResponse(
			request({ Range: range }),
			fixture,
			"video/mp4",
		);
		expect(response.status).toBe(206);
		expect(response.headers.get("Content-Range")).toBe(contentRange);
		expect(response.headers.get("Content-Length")).toBe(String(body.length));
		expect(response.headers.get("Content-Type")).toBe("video/mp4");
		expect(await response.text()).toBe(body);
	});

	it.each(["bytes=10-", "bytes=4-2", "bytes=-0"])(
		"rejects unsatisfiable range %s",
		async (range) => {
			const response = createMediaFileResponse(
				request({ Range: range }),
				fixture,
				"video/mp4",
			);
			expect(response.status).toBe(416);
			expect(response.headers.get("Content-Range")).toBe("bytes */10");
			expect(response.headers.get("Content-Length")).toBe("0");
			expect(await response.text()).toBe("");
		},
	);

	it("rejects a range on an empty file", () => {
		const response = createMediaFileResponse(
			request({ Range: "bytes=0-" }),
			new Blob(),
			"audio/mpeg",
		);
		expect(response.status).toBe(416);
		expect(response.headers.get("Content-Range")).toBe("bytes */0");
	});

	it.each(["items=0-3", "bytes=0-1,4-5", "bytes=invalid", "bytes=-"])(
		"ignores unsupported or malformed range %s",
		async (range) => {
			const response = createMediaFileResponse(
				request({ Range: range }),
				fixture,
				"video/mp4",
			);
			expect(response.status).toBe(200);
			expect(response.headers.has("Content-Range")).toBe(false);
			expect(await response.text()).toBe("0123456789");
		},
	);

	it("sends the complete representation when If-Range cannot be validated", async () => {
		const response = createMediaFileResponse(
			request({ Range: "bytes=0-3", "If-Range": '"old-representation"' }),
			fixture,
			"video/mp4",
		);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("0123456789");
	});

	it("returns representation headers without a body for HEAD", async () => {
		const response = createMediaFileResponse(
			request({ Range: "bytes=0-3" }, "HEAD"),
			fixture,
			"video/mp4",
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Length")).toBe("10");
		expect(response.headers.get("Content-Type")).toBe("video/mp4");
		expect(await response.text()).toBe("");
	});
});
