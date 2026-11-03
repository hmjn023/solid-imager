import type { APIRequestContext } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type {
	McpConfig,
	McpToolInfo,
} from "@solid-imager/core/domain/config/mcp";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
	mediaPath,
	getE2eRuntimeDir,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test.use({ launchOptions: { args: ["--enable-features=WebMCP"] } });

async function mcpResponse(
	request: APIRequestContext,
	method: string,
	params: object,
) {
	const response = await request.post("/api/mcp", {
		headers: { Accept: "application/json, text/event-stream" },
		data: { jsonrpc: "2.0", id: 1, method, params },
	});
	const text = await response.text();
	const data = response.headers()["content-type"]?.includes("text/event-stream")
		? text
				.split("\n")
				.find((line) => line.startsWith("data:"))
				?.slice(5)
		: text;
	if (!data) throw new Error(`Empty MCP response for ${method}`);
	return JSON.parse(data);
}

async function rpc(request: APIRequestContext, method: string, params: object) {
	const message = await mcpResponse(request, method, params);
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

test("settings publish oRPC data tools independently and revoke cached calls", async ({
	page,
	request,
}) => {
	const config = async (action: string, input?: object) => {
		const response = await request.post("/api/rpc/config/" + action, {
			data: { json: input },
		});
		expect(response.ok()).toBe(true);
		return (await response.json()).json;
	};
	const initial: McpConfig = (await config("get")).mcp;
	const catalog: McpToolInfo[] = await config("mcpCatalog");
	const candidates = catalog
		.filter((tool) => !tool.webOnly)
		.map((tool) => tool.name)
		.sort();
	expect(candidates.length).toBeGreaterThan(100);
	expect(candidates).toEqual(
		expect.arrayContaining([
			"tags_list",
			"media_search",
			"jobs_retry",
			"authors_create",
		]),
	);
	for (const excluded of [
		"media_getContent",
		"media_upload",
		"sources_events",
		"jobs_downloadArtifact",
		"utils_fetchUrl",
		"config_update",
		"config_callWebTool",
		"open_media",
	]) {
		expect(candidates).not.toContain(excluded);
	}
	try {
		await config("update", { mcp: { http: candidates, web: [] } });
		const all = await rpc(request, "tools/list", {});
		expect(all.tools.map((tool: { name: string }) => tool.name).sort()).toEqual(
			candidates,
		);
		const tags = await rpc(request, "tools/call", {
			name: "tags_list",
			arguments: {},
		});
		expect(tags.isError).not.toBe(true);
		expect(JSON.parse(tags.content[0].text)).toEqual(expect.any(Array));
		await config("update", { mcp: { http: [] } });
		expect((await rpc(request, "tools/list", {})).tools).toEqual([]);
		await page.goto("/config");
		await waitForAppHydration(page);
		const category = page.getByRole("tab", { name: /MCP/ });
		await category.click();
		await page
			.getByRole("textbox", { name: "ツールを絞り込む" })
			.fill("jobs_list");
		const http = page.getByRole("checkbox", { name: "HTTP MCP jobs_list" });
		const web = page.getByRole("checkbox", { name: "WebMCP jobs_list" });
		await expect(http).not.toBeChecked();
		await web.press("Space");
		await expect(web).toBeChecked();
		await page.getByRole("button", { name: "Save Changes" }).click();
		await expect
			.poll(async () => (await page.webmcp.tools()).map((t) => t.name))
			.toEqual(["jobs_list"]);
		expect((await rpc(request, "tools/list", {})).tools).toEqual([]);
		expect(await page.webmcp.callTool("jobs_list", { limit: 1 })).toMatchObject(
			{ items: expect.any(Array) },
		);
		expect(new URL(page.url()).pathname).toBe("/config");
		await page.reload();
		await category.click();
		await page
			.getByRole("textbox", { name: "ツールを絞り込む" })
			.fill("jobs_list");
		await expect(web).toBeChecked();
		await web.press("Space");
		await expect(web).not.toBeChecked();
		await page
			.locator("label")
			.filter({ hasText: "HTTP MCP jobs_list" })
			.click();
		await expect(http).toBeChecked();
		await page.getByRole("button", { name: "Save Changes" }).click();
		await expect
			.poll(async () =>
				(await rpc(request, "tools/list", {})).tools.map(
					(t: { name: string }) => t.name,
				),
			)
			.toEqual(["jobs_list"]);
		await expect
			.poll(async () => (await page.webmcp.tools()).map((t) => t.name))
			.toEqual([]);
		const saved = JSON.parse(
			await readFile(path.join(getE2eRuntimeDir(), "config.json"), "utf8"),
		);
		expect(saved.mcp).toEqual({ http: ["jobs_list"], web: [] });
		expect(
			(
				await rpc(request, "tools/call", {
					name: "jobs_list",
					arguments: { limit: 1 },
				})
			).structuredContent,
		).toMatchObject({ items: expect.any(Array) });
		const denied = await request.post("/api/rpc/config/callWebTool", {
			data: { json: { name: "jobs_list", arguments: {} } },
		});
		expect(denied.status()).toBe(404);
		await config("update", {
			mcp: { http: ["config_update", "open_media"], web: ["config_update"] },
		});
		expect(
			(
				await mcpResponse(request, "tools/call", {
					name: "jobs_list",
					arguments: {},
				})
			).error,
		).toBeDefined();
		expect((await rpc(request, "tools/list", {})).tools).toEqual([]);
		expect(await config("webTools")).toEqual([]);
	} finally {
		await config("update", { mcp: initial });
	}
});

test("an acknowledged tag edit never reopens the image after the user leaves", async ({
	page,
	request,
}) => {
	const created = await request.post("/api/rpc/tags/create", {
		data: { json: { name: "e2e-follow-edit-once" } },
	});
	expect(created.ok()).toBe(true);
	const { id } = (await created.json()).json;
	const saved = Promise.withResolvers<void>();
	const release = Promise.withResolvers<void>();
	let writes = 0;
	try {
		await page.goto(mediaPath());
		await waitForAppHydration(page);
		await expect
			.poll(async () =>
				(await page.webmcp.tools()).some(
					(tool) => tool.name === "edit_media_tags",
				),
			)
			.toBe(true);
		await page.route("**/api/rpc/config/callWebTool", async (route) => {
			writes++;
			const response = await route.fetch();
			saved.resolve();
			await release.promise;
			await route.fulfill({ response });
		});
		const edit = page.webmcp.callTool("edit_media_tags", {
			sourceId: E2E_SOURCE_ID,
			mediaId: E2E_PRIMARY_MEDIA_ID,
			action: "add",
			tagIds: [id],
		});
		await saved.promise;
		await page.getByRole("link", { name: "Jobs", exact: true }).first().click();
		await expect(page).toHaveURL(/\/jobs$/);
		release.resolve();
		expect(await edit).toMatchObject({
			success: true,
			presentation: "unconfirmed",
		});
		await expect(page).toHaveURL(/\/jobs$/);
		expect(writes).toBe(1);
	} finally {
		release.resolve();
		await request.post("/api/rpc/tags/delete", { data: { json: { id } } });
	}
});
