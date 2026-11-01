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

async function listSourcesFromScalar(page: Page, restPrefix: string) {
	await page
		.getByRole("button", { name: /Test Request.*POST \/tools\/list_sources/i })
		.click();
	const result = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === restPrefix + "/tools/list_sources" &&
			response.request().method() === "POST",
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

test("Scalar sends its documented request to the local REST API", async ({
	page,
}) => {
	await page.goto("/about");
	await page
		.getByRole("link", { name: "API documentation", exact: true })
		.click();
	await expect(page).toHaveURL(/\/docs\/scalar\/?(?:#.*)?$/);
	await listSourcesFromScalar(page, "/api/rest");
});

test("the published REST server shares RPC data and returns standard HTTP errors", async ({
	request,
}) => {
	const specResponse = await request.get("/openapi.json");
	const spec = await specResponse.json();
	expect(spec.servers).toMatchObject([{ url: "api/rest" }]);
	expect(spec.paths).not.toHaveProperty("/media/getContent");
	expect(spec.paths["/tags/create"].post.requestBody.content).toHaveProperty(
		"application/json",
	);
	const rest = new URL(spec.servers[0].url, specResponse.url()).pathname;
	const location = { sourceId: E2E_SOURCE_ID, mediaId: E2E_SOURCE_ID };
	expect(
		(
			await request.post(rest + "/media/getContent", { data: location })
		).status(),
	).toBe(404);
	expect(
		(
			await request.post("/api/rpc/media/getContent", {
				data: { json: location },
			})
		).status(),
	).toBe(400);
	const name = "scalar-" + randomUUID();
	const created = await request.post(rest + "/tags/create", { data: { name } });
	expect(created.status()).toBe(200);
	const tag = await created.json();
	expect(tag).toMatchObject({ id: expect.any(String), name });
	try {
		const rpc = await request.post("/api/rpc/tags/get", {
			data: { json: { id: tag.id } },
		});
		expect(await rpc.json()).toMatchObject({ json: { id: tag.id, name } });
		expect(
			(
				await request.post(rest + "/tags/get", { data: { id: "bad-id" } })
			).status(),
		).toBe(400);
		expect((await request.get(rest + "/tags/list")).status()).toBe(404);
		expect((await request.post(rest + "/unknown")).status()).toBe(404);
		const foreignForm = await request.post(rest + "/tags/delete", {
			headers: { Origin: "https://untrusted.example" },
			form: { id: tag.id },
		});
		expect(foreignForm.status()).toBe(403);
	} finally {
		expect(
			(
				await request.post(rest + "/tags/delete", { data: { id: tag.id } })
			).ok(),
		).toBe(true);
	}
});

test("REST accepts the documented multipart upload and detects an existing file", async ({
	request,
}) => {
	const file = await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME));
	const response = await request.post("/api/rest/media/upload", {
		multipart: {
			sourceId: E2E_SOURCE_ID,
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

test("the standalone documentation bookmark opens the bundled Scalar page", async ({
	page,
}) => {
	await page.goto("/api-docs.html");
	await expect(page).toHaveURL(/\/docs\/scalar\/?(?:#.*)?$/);
	await expect(
		page.getByRole("heading", { name: "Solid Imager oRPC API", exact: true }),
	).toBeVisible();
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
	const spec = page.waitForResponse(
		(response) => new URL(response.url()).pathname === prefix + "/openapi.json",
	);
	await page.goto(prefix + "/docs/scalar/");
	expect((await spec).ok()).toBe(true);
	await listSourcesFromScalar(page, prefix + "/api/rest");
});

test("legacy Swagger bookmarks redirect relative to their public mount", async ({
	request,
}) => {
	for (const path of ["/docs/swagger", "/docs/swagger/"]) {
		const result = await request.get(path + "?lang=ja", { maxRedirects: 0 });
		expect(result.status()).toBe(302);
		const publicURL = new URL("/imager" + path, "https://imager.example.test");
		expect(new URL(result.headers().location, publicURL).href).toBe(
			"https://imager.example.test/imager/docs/scalar?lang=ja",
		);
	}
});

test("REST behind TLS termination validates the configured public Origin", async ({
	request,
}) => {
	const path = "/api/rest/sources/list";
	const publicOrigin = "https://imager.example.test";
	const valid = await request.post(path, { headers: { Origin: publicOrigin } });
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
