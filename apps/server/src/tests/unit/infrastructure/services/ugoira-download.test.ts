import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadUgoiraArchive } from "~/infrastructure/services/ugoira-download";

vi.mock("node:fs/promises", () => ({ default: { open: vi.fn() } }));
const writeFile = vi.fn();
const close = vi.fn();
const fetchMock = vi.fn<typeof fetch>();
const targetUrl =
	"https://i.pximg.net/img-zip-ugoira/img/2022/09/05/00/00/00/101003492_ugoira1920x1080.zip";
const page = "https://www.pixiv.net/artworks/101003492";
const item = {
	targetUrl,
	sourceUrls: [targetUrl, page],
	userAgent: "xtracter fixture",
};

beforeEach(() => {
	vi.resetAllMocks();
	vi.stubGlobal("fetch", fetchMock);
	vi.mocked(fs.open).mockResolvedValue({ writeFile, close } as any);
});
afterEach(() => vi.unstubAllGlobals());

describe("ugoira archive downloads", () => {
	it("streams with the matching artwork Referer, without forwarding browser cookies", async () => {
		fetchMock.mockResolvedValue(
			new Response(new Uint8Array([80, 75, 3, 4]), {
				headers: { "content-type": "application/zip" },
			}),
		);
		await downloadUgoiraArchive(
			{ ...item, cookies: [{ name: "session", value: "private" }] },
			"/tmp/archive.zip",
		);
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
			targetUrl,
			expect.objectContaining({
				redirect: "error",
				headers: {
					Referer: page,
					Accept: "application/zip, application/octet-stream",
					"User-Agent": "xtracter fixture",
				},
			}),
		);
		expect(fs.open).toHaveBeenCalledWith("/tmp/archive.zip", "wx");
		expect(writeFile).toHaveBeenCalledWith(new Uint8Array([80, 75, 3, 4]));
		expect(close).toHaveBeenCalledOnce();
	});
	it.each([
		{
			targetUrl:
				"https://i.pximg.net.attacker.test/img-zip-ugoira/101003492_ugoira1920x1080.zip",
		},
		{ targetUrl: targetUrl.replace("https:", "http:") },
		{ targetUrl: targetUrl.replace("i.pximg.net", "user:pass@i.pximg.net") },
		{ targetUrl: targetUrl.replace("img-zip-ugoira", "img-original") },
		{ sourceUrls: [targetUrl, "https://www.pixiv.net/artworks/999"] },
		{
			sourceUrls: [
				targetUrl,
				"https://www.pixiv.net.attacker.test/artworks/101003492",
			],
		},
		{ sourceUrls: [] },
	])(
		"rejects an unrelated or malformed target/referrer before networking: %j",
		async (overrides) => {
			await expect(
				downloadUgoiraArchive({ ...item, ...overrides }, "/tmp/archive.zip"),
			).rejects.toThrow();
			expect(fetchMock).not.toHaveBeenCalled();
			expect(fs.open).not.toHaveBeenCalled();
		},
	);
	it.each([
		{
			response: () => new Response("forbidden", { status: 403 }),
			message: "HTTP 403",
		},
		{
			response: () =>
				new Response("login", { headers: { "content-type": "text/html" } }),
			message: "unsupported content type",
		},
		{
			response: () =>
				new Response("zip", {
					headers: {
						"content-type": "application/zip",
						"content-length": String(256 * 1024 * 1024 + 1),
					},
				}),
			message: "exceeds 256 MiB",
		},
	])(
		"rejects unsuccessful, non-archive and oversized responses: $message",
		async ({ response, message }) => {
			fetchMock.mockResolvedValue(response());
			await expect(
				downloadUgoiraArchive(item, "/tmp/archive.zip"),
			).rejects.toThrow(message);
			expect(fs.open).not.toHaveBeenCalled();
		},
	);
	it("enforces the byte limit even without a Content-Length", async () => {
		const chunk = new Uint8Array(1024 * 1024);
		const cancel = vi.fn();
		fetchMock.mockResolvedValue(
			new Response(
				new ReadableStream({
					pull(controller) {
						controller.enqueue(chunk);
					},
					cancel,
				}),
				{ headers: { "content-type": "application/zip" } },
			),
		);
		await expect(
			downloadUgoiraArchive(item, "/tmp/archive.zip"),
		).rejects.toThrow("exceeds 256 MiB");
		expect(writeFile).toHaveBeenCalledTimes(256);
		expect(cancel).toHaveBeenCalled();
		expect(close).toHaveBeenCalledOnce();
	});
	it("closes the file and cancels the response on disk failure", async () => {
		const cancel = vi.fn();
		fetchMock.mockResolvedValue(
			new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array([1]));
					},
					cancel,
				}),
				{ headers: { "content-type": "application/zip" } },
			),
		);
		writeFile.mockRejectedValueOnce(new Error("disk full"));
		await expect(
			downloadUgoiraArchive(item, "/tmp/archive.zip"),
		).rejects.toThrow("disk full");
		expect(cancel).toHaveBeenCalled();
		expect(close).toHaveBeenCalledOnce();
	});
});
