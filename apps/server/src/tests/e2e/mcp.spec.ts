import type { APIRequestContext } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
	mediaPath,
	getE2eRuntimeDir,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test.use({ launchOptions: { args: ["--enable-features=WebMCP"] } });

async function rpc(request: APIRequestContext, method: string, params: object) {
	const response = await request.post("/api/mcp", {
		headers: { Accept: "application/json, text/event-stream" },
		data: { jsonrpc: "2.0", id: 1, method, params },
	});
	expect(response.status()).toBe(200);
	const text = await response.text();
	const data = response.headers()["content-type"]?.includes("text/event-stream")
		? text
				.split("\n")
				.find((line) => line.startsWith("data:"))
				?.slice(5)
		: text;
	if (!data) throw new Error(`Empty MCP response for ${method}`);
	const message = JSON.parse(data);
	expect(message.error).toBeUndefined();
	return message.result;
}

test("HTTP MCP and visible WebMCP tools edit the same media tags", async ({
	page,
	request,
}) => {
	const location = { sourceId: E2E_SOURCE_ID, mediaId: E2E_PRIMARY_MEDIA_ID };
	const init = await rpc(request, "initialize", {
		protocolVersion: "2025-11-25",
		capabilities: {},
		clientInfo: { name: "solid-imager-test", version: "1" },
	});
	expect(init.serverInfo.name).toBe("solid-imager");
	const list = await rpc(request, "tools/list", {});
	const names = [
		"create_local_source",
		"edit_media_tags",
		"find_tags",
		"get_media_details",
		"list_sources",
		"search_media",
	];
	expect(list.tools.map((tool: { name: string }) => tool.name).sort()).toEqual(
		names,
	);
	// Discovery comes from the same oRPC schemas that validate tool calls.
	expect(list.tools).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				name: "search_media",
				annotations: expect.objectContaining({
					readOnlyHint: true,
					openWorldHint: false,
				}),
				outputSchema: expect.objectContaining({ type: "object" }),
			}),
			expect.objectContaining({
				name: "create_local_source",
				annotations: expect.objectContaining({
					readOnlyHint: false,
					idempotentHint: false,
				}),
			}),
			expect.objectContaining({
				name: "edit_media_tags",
				annotations: expect.objectContaining({
					readOnlyHint: false,
					idempotentHint: true,
				}),
			}),
		]),
	);
	const call = (name: string, args: object) =>
		rpc(request, "tools/call", { name, arguments: args });
	const search = await call("search_media", { query: E2E_PRIMARY_FILE_NAME });
	expect(search.structuredContent.media).toEqual([
		expect.objectContaining({
			id: E2E_PRIMARY_MEDIA_ID,
			mediaSourceId: E2E_SOURCE_ID,
		}),
	]);
	expect(search.structuredContent.media[0]).not.toHaveProperty("filePath");
	expect(
		(await call("edit_media_tags", { ...location, action: "add", tagIds: [] }))
			.isError,
	).toBe(true);

	await page.goto(mediaPath());
	await waitForAppHydration(page);
	await expect
		.poll(async () =>
			(await page.webmcp.tools()).map((tool) => tool.name).sort(),
		)
		.toEqual(
			names
				.filter((name) => name !== "get_media_details")
				.concat("get_current_view", "open_media")
				.sort(),
		);
	const tagName = "e2e-mcp-tag";
	const create = await request.post("/api/rpc/tags/create", {
		data: { json: { name: tagName } },
	});
	expect(create.ok()).toBe(true);
	const { id } = (await create.json()).json;
	const edit = { ...location, tagIds: [id] };
	try {
		expect(
			await page.webmcp.callTool("find_tags", { query: tagName }),
		).toMatchObject({ tags: [{ id, name: tagName }] });
		expect(
			await page.webmcp.callTool("edit_media_tags", { ...edit, action: "add" }),
		).toEqual({ success: true });
		expect(
			(await call("edit_media_tags", { ...edit, action: "add" }))
				.structuredContent,
		).toEqual({ success: true });
		await expect(
			page.getByText(tagName, { exact: true }).first(),
		).toBeVisible();
		await expect(
			page.getByText("AI: 画像のタグを編集しました", { exact: true }),
		).toBeVisible();
		const details = await call("get_media_details", location);
		expect(
			details.structuredContent.tags.filter(
				(tag: { id: string }) => tag.id === id,
			),
		).toEqual([{ id, name: tagName, type: "positive" }]);
		expect(
			(await call("edit_media_tags", { ...edit, action: "remove" }))
				.structuredContent,
		).toEqual({ success: true });
		const updated = await page.webmcp.callTool("open_media", location);
		expect(updated).toMatchObject({
			id: E2E_PRIMARY_MEDIA_ID,
			tags: {
				items: expect.not.arrayContaining([expect.objectContaining({ id })]),
			},
		});
	} finally {
		const cleanup = await request.post("/api/rpc/tags/delete", {
			data: { json: { id } },
		});
		expect(cleanup.ok()).toBe(true);
	}
});

test("sources created through HTTP MCP and WebMCP are persisted and discoverable", async ({
	page,
	request,
}) => {
	const directory = await mkdtemp(path.join(getE2eRuntimeDir(), "mcp-source-"));
	const sourceIds: string[] = [];
	const call = (name: string, args: object) =>
		rpc(request, "tools/call", { name, arguments: args });
	try {
		const invalid = await call("create_local_source", {
			name: "",
			path: directory,
		});
		expect(invalid.isError).toBe(true);
		const created = await call("create_local_source", {
			name: "MCP HTTP source",
			path: directory,
		});
		expect(created.isError).toBeUndefined();
		const source = created.structuredContent.source;
		sourceIds.push(source.id);
		expect(source).toMatchObject({
			name: "MCP HTTP source",
			type: "local",
			connectionInfo: { path: directory },
		});
		await page.goto("/sources");
		await waitForAppHydration(page);
		await expect
			.poll(async () =>
				(await page.webmcp.tools()).some(
					(tool) => tool.name === "list_sources",
				),
			)
			.toBe(true);
		expect(await page.webmcp.callTool("list_sources")).toMatchObject({
			items: expect.arrayContaining([
				expect.objectContaining({ id: source.id }),
			]),
		});
		await expect(
			page.getByText("MCP HTTP source", { exact: true }),
		).toBeVisible();
		const webDirectory = await mkdtemp(path.join(directory, "web-"));
		const web = await page.webmcp.callTool("create_local_source", {
			name: "MCP Web source",
			path: webDirectory,
		});
		sourceIds.push(web.source.id);
		await expect(
			page.getByText("MCP Web source", { exact: true }),
		).toBeVisible();
		const list = await call("list_sources", {});
		expect(list.structuredContent.sources).toEqual(
			expect.arrayContaining(
				sourceIds.map((id) => expect.objectContaining({ id })),
			),
		);
		await page.reload();
		await waitForAppHydration(page);
		await expect(
			page.getByText("MCP Web source", { exact: true }),
		).toBeVisible();
	} finally {
		for (const id of sourceIds.reverse()) {
			const response = await request.post("/api/rpc/sources/delete", {
				data: { json: { id } },
			});
			expect(response.ok()).toBe(true);
		}
		await rm(directory, { recursive: true, force: true });
	}
});

test("HTTP MCP rejects untrusted browser origins", async ({ request }) => {
	const response = await request.post("/api/mcp", {
		headers: { Origin: "https://untrusted.example" },
		data: {},
	});
	expect(response.status()).toBe(403);
});

test("HTTP MCP serves per-request tool discovery without a legacy handshake", async ({
	request,
}) => {
	const version = "2026-07-28";
	const response = await request.post("/api/mcp", {
		headers: {
			Accept: "application/json, text/event-stream",
			"MCP-Protocol-Version": version,
			"Mcp-Method": "tools/list",
		},
		data: {
			jsonrpc: "2.0",
			id: 1,
			method: "tools/list",
			params: {
				_meta: {
					"io.modelcontextprotocol/protocolVersion": version,
					"io.modelcontextprotocol/clientInfo": {
						name: "solid-imager-test",
						version: "1",
					},
					"io.modelcontextprotocol/clientCapabilities": {},
				},
			},
		},
	});
	expect(response.status()).toBe(200);
	expect((await response.json()).result.tools).toContainEqual(
		expect.objectContaining({ name: "edit_media_tags" }),
	);
});

test("WebMCP shows searches, opens images, and preserves visible history across reload", async ({
	page,
}) => {
	await page.goto(mediaPath());
	await waitForAppHydration(page);
	await expect
		.poll(async () =>
			(await page.webmcp.tools()).some((tool) => tool.name === "open_media"),
		)
		.toBe(true);
	const tools = await page.webmcp.tools();
	for (const name of ["search_media", "open_media", "edit_media_tags"]) {
		expect(
			tools.find((tool) => tool.name === name)?.annotations?.readOnly,
		).not.toBe(true);
	}
	const input = { sourceId: E2E_SOURCE_ID, query: E2E_PRIMARY_FILE_NAME };
	const result = await page.webmcp.callTool("search_media", input);
	expect(result).toMatchObject({
		view: "search",
		ready: true,
		total_count: 1,
		items: [{ id: E2E_PRIMARY_MEDIA_ID }],
	});
	expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500);
	const image = page.getByRole("link", {
		name: new RegExp(E2E_PRIMARY_FILE_NAME),
	});
	await expect(image).toBeVisible();
	await expect(page).toHaveURL(/\/search\?search=/);
	const searchUrl = page.url();
	await image.click({ modifiers: ["Control"] });
	expect(await page.webmcp.callTool("get_current_view")).toMatchObject({
		selected_count: 1,
		items: [{ id: E2E_PRIMARY_MEDIA_ID, selected: true }],
	});
	const opened = await page.webmcp.callTool("open_media", {
		sourceId: E2E_SOURCE_ID,
		mediaId: E2E_PRIMARY_MEDIA_ID,
	});
	expect(opened).toMatchObject({ view: "media", id: E2E_PRIMARY_MEDIA_ID });
	await expect(
		page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(searchUrl);
	await expect(image).toBeVisible();
	await page.reload();
	await waitForAppHydration(page);
	await expect(image).toBeVisible();
	await expect
		.poll(async () =>
			(await page.webmcp.tools()).some((tool) => tool.name === "search_media"),
		)
		.toBe(true);
	const empty = await page.webmcp.callTool("search_media", {
		query: "no-match-webmcp-visibility",
	});
	expect(empty).toMatchObject({ ready: true, total_count: 0, items: [] });
	await expect(image).toHaveCount(0);
	await page.reload();
	await waitForAppHydration(page);
	await expect(image).toHaveCount(0);
	await expect
		.poll(async () =>
			(await page.webmcp.tools()).some((tool) => tool.name === "search_media"),
		)
		.toBe(true);
	expect(
		await page.webmcp.callTool("open_media", {
			sourceId: "bad",
			mediaId: "bad",
		}),
	).toMatchObject({ code: "INVALID_INPUT", retryable: false });
	await expect(
		page.getByText("AI: 画像の詳細を表示できませんでした", { exact: true }),
	).toBeVisible();
});

test("WebMCP waits for visible results and protects an open filter dialog", async ({
	page,
}) => {
	await page.goto("/search");
	await waitForAppHydration(page);
	// Warm the unfiltered result before asking WebMCP to replace it. A detail
	// page has no previous list and cannot expose placeholder-data races.
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	await expect
		.poll(async () =>
			(await page.webmcp.tools()).some((tool) => tool.name === "search_media"),
		)
		.toBe(true);
	let release = () => {};
	let reached = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const requested = new Promise<void>((resolve) => {
		reached = resolve;
	});
	await page.route("**/api/rpc/media/search", async (route) => {
		reached();
		await gate;
		await route.continue();
	});
	let settled = false;
	const pending = page.webmcp
		.callTool("search_media", { query: E2E_PRIMARY_FILE_NAME })
		.finally(() => {
			settled = true;
		});
	try {
		await requested;
		await expect(
			page.getByText("AI: メディアを検索中…", { exact: true }),
		).toBeVisible();
		expect(settled).toBe(false);
		expect(
			await page.webmcp.callTool("search_media", { query: "another" }),
		).toMatchObject({ code: "BUSY" });
	} finally {
		release();
	}
	expect(await pending).toMatchObject({
		view: "search",
		ready: true,
		total_count: 1,
		items: [{ id: E2E_PRIMARY_MEDIA_ID, fileName: E2E_PRIMARY_FILE_NAME }],
	});
	await page.unroute("**/api/rpc/media/search");
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	await page.getByRole("button", { name: /^検索フィルター/ }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	const url = page.url();
	expect(
		await page.webmcp.callTool("open_media", {
			sourceId: E2E_SOURCE_ID,
			mediaId: E2E_PRIMARY_MEDIA_ID,
		}),
	).toMatchObject({ code: "VIEW_BUSY" });
	await expect(page).toHaveURL(url);
	await expect(dialog).toBeVisible();
});

test("WebMCP reports a failed visible search and can recover", async ({
	page,
	browserHealth,
}) => {
	await page.goto(mediaPath());
	await waitForAppHydration(page);
	await expect
		.poll(async () =>
			(await page.webmcp.tools()).some((tool) => tool.name === "search_media"),
		)
		.toBe(true);
	browserHealth.allowResponseFailure("/api/rpc/media/search");
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 503",
	);
	await page.route("**/api/rpc/media/search", (route) =>
		route.fulfill({
			status: 503,
			contentType: "text/plain",
			body: "Service Unavailable",
		}),
	);
	expect(
		await page.webmcp.callTool("search_media", {
			query: E2E_PRIMARY_FILE_NAME,
		}),
	).toMatchObject({ code: "SEARCH_FAILED" });
	await expect(
		page.getByText("AI: メディアを検索できませんでした", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("検索結果を取得できませんでした", { exact: true }),
	).toBeVisible();
	await page.unroute("**/api/rpc/media/search");
	await page.getByRole("button", { name: "再試行", exact: true }).click();
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	expect(await page.webmcp.callTool("get_current_view")).toMatchObject({
		view: "search",
		ready: true,
		total_count: 1,
	});
});
