import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
	E2E_SOURCE_ID,
	E2E_SOURCE_NAME,
	E2E_PRIMARY_FILE_NAME,
	getFixtureMediaPath,
} from "./support/fixture";
import { expect, test } from "./support/test";

async function listSourcesFromScalar(page: Page, apiPrefix: string) {
	// Scalar renders operations lazily; open the requested group and operation first.
	await page
		.getByRole("button", { name: "Open Group - Media Tools", exact: true })
		.click();
	await page
		.getByRole("complementary")
		.locator('a[href$="/GET/tools/sources"]')
		.click();
	await page
		.getByRole("button", { name: /Test Request.*GET \/tools\/sources/i })
		.click();
	const result = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === apiPrefix + "/tools/sources" &&
			response.request().method() === "GET",
	);
	await page
		.getByRole("button", { name: /^Send Request/i })
		.first()
		.click();
	const response = await result;
	expect(response.ok()).toBe(true);
	expect(await response.json()).toMatchObject({
		sources: expect.arrayContaining([
			expect.objectContaining({ id: E2E_SOURCE_ID, name: E2E_SOURCE_NAME }),
		]),
	});
	await expect(
		page.getByText(E2E_SOURCE_NAME, { exact: false }).first(),
	).toBeVisible();
}

test("Scalar sends its documented request to the local HTTP API", async ({
	page,
}) => {
	await page.goto("/about");
	const popup = page.waitForEvent("popup");
	await page
		.getByRole("main")
		.getByRole("link", { name: "APIドキュメント", exact: true })
		.click();
	const reference = await popup;
	await expect(reference).toHaveURL(/\/docs\/scalar\/?(?:#.*)?$/);
	await listSourcesFromScalar(reference, "/api");
	await reference.close();
});

test("the published API exposes typed resource operations and HTTP errors", async ({
	request,
}) => {
	const specResponse = await request.get("/openapi.json");
	const spec = await specResponse.json();
	expect(spec.servers).toMatchObject([{ url: "api" }]);
	expect(
		spec.paths["/sources/{sourceId}/media/{mediaId}/content"],
	).toHaveProperty("head");
	expect(spec.paths["/tags"].post.requestBody.content).toHaveProperty(
		"application/json",
	);
	expect(spec.paths).not.toHaveProperty("/viewer/pixiv/session");
	expect((await request.post("/api/rpc/sources/list")).status()).toBe(404);
	expect((await request.post("/api/rest/sources/list")).status()).toBe(404);
	const name = "scalar-" + randomUUID();
	const created = await request.post("/api/tags", { data: { name } });
	expect(created.ok()).toBe(true);
	const tag = await created.json();
	const path = `/api/tags/${tag.id}`;
	try {
		const fetched = await request.get(path);
		expect(await fetched.json()).toMatchObject({ id: tag.id, name });
		expect((await request.get("/api/tags/bad-id")).status()).toBe(400);
		expect((await request.post("/api/unknown")).status()).toBe(404);
		const foreignMutation = await request.delete(path, {
			headers: { Origin: "https://untrusted.example" },
		});
		expect(foreignMutation.status()).toBe(403);
	} finally {
		expect((await request.delete(path)).ok()).toBe(true);
	}
});

test("HTTP API accepts the documented multipart upload and detects an existing file", async ({
	request,
}) => {
	const file = await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	const response = await request.post(`/api/sources/${E2E_SOURCE_ID}/media`, {
		multipart: {
			file: {
				name: E2E_PRIMARY_FILE_NAME,
				mimeType: "image/png",
				buffer: file,
			},
		},
	});
	expect(response.status()).toBe(200);
	expect(await response.json()).toMatchObject({
		success: false,
		conflict: { existingFile: expect.stringContaining(E2E_PRIMARY_FILE_NAME) },
	});
});

test("the API documentation opens the bundled Scalar page on navigation and reload", async ({
	page,
}) => {
	let specRequests = 0;
	page.on("request", (request) => {
		if (new URL(request.url()).pathname === "/openapi.json") specRequests++;
	});
	await page.goto("/docs/scalar");
	await expect(page).toHaveURL(/\/docs\/scalar\/?(?:#.*)?$/);
	await expect(
		page.getByRole("heading", { name: "Solid Imager oRPC API", exact: true }),
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Solid Imager oRPC API", exact: true }),
	).toBeVisible();
	expect(specRequests).toBe(0);
});

test("the API reference lists operations with JavaScript disabled", async ({
	browser,
	baseURL,
}) => {
	const context = await browser.newContext({
		baseURL,
		javaScriptEnabled: false,
	});
	try {
		const page = await context.newPage();
		await page.goto("/docs/scalar");
		await expect(
			page.getByRole("heading", { name: "Solid Imager oRPC API" }),
		).toBeVisible();
		await page.getByText("API operations", { exact: true }).click();
		await expect(
			page.getByText("GET /tools/sources", { exact: true }),
		).toBeVisible();
	} finally {
		await context.close();
	}
});

test("Scalar works when a proxy serves only /imager/ and strips the prefix", async ({
	page,
	baseURL,
}) => {
	const prefix = "/imager";
	if (!baseURL) throw new Error("Missing Playwright baseURL");
	const server = new URL(baseURL);
	await page.route(
		(url) => url.origin === server.origin,
		async (route) => {
			const external = new URL(route.request().url());
			if (!external.pathname.startsWith(prefix + "/")) {
				await route.fulfill({ status: 404, body: "Outside proxy mount" });
				return;
			}
			external.pathname = external.pathname.slice(prefix.length);
			await route.fulfill({
				response: await route.fetch({ url: external.href }),
			});
		},
	);
	const response = await page.goto(prefix + "/docs/scalar/");
	expect(response?.ok()).toBe(true);
	await listSourcesFromScalar(page, prefix + "/api");
});

test("the HTTP API behind TLS termination validates the configured public Origin", async ({
	request,
}) => {
	const path = "/api/media/search";
	const publicOrigin = "https://imager.example.test";
	const valid = await request.post(path, {
		headers: { Origin: publicOrigin },
		data: { params: { limit: 1 } },
	});
	expect(valid.status()).toBe(200);
	const rejected: Record<string, string>[] = [
		{
			Origin: "https://foreign.example.test",
			"X-Forwarded-Proto": "https",
			"X-Forwarded-Host": "foreign.example.test",
		},
		{ Origin: "null" },
		{ Origin: publicOrigin, "Sec-Fetch-Site": "cross-site" },
	];
	for (const headers of rejected) {
		expect((await request.post(path, { headers })).status()).toBe(403);
	}
});
