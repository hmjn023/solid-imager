import { expect, test } from "@playwright/test";

const HTTP_OK = 200;
const HTTP_INTERNAL_SERVER_ERROR = 500;

test.describe("SSR Crashing Check - E2E", () => {
	const pages = ["/", "/about", "/config", "/manager", "/search", "/sources"];

	for (const pagePath of pages) {
		test(`should load ${pagePath} without crashing`, async ({ page }) => {
			const response = await page.goto(pagePath);
			// Ensure the response was successful (200 OK)
			expect(response?.status()).toBe(HTTP_OK);
		});
	}

	test("should load dynamic route /sources/123 without crashing", async ({
		page,
	}) => {
		const response = await page.goto("/sources/123");
		// Ensure the response does not indicate a server crash (500)
		expect(response?.status()).toBeLessThan(HTTP_INTERNAL_SERVER_ERROR);
	});

	test("should load a media detail route without an SSR failure", async ({
		page,
	}) => {
		const hydrationWarnings: string[] = [];
		page.on("console", (message) => {
			if (message.text().includes("Hydration Mismatch")) {
				hydrationWarnings.push(message.text());
			}
		});

		const mediaDetailPath =
			"/sources/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002";
		const ssrResponse = await page.request.get(mediaDetailPath);
		expect(ssrResponse.status()).toBe(HTTP_OK);
		expect(await ssrResponse.text()).not.toContain("画面を読み込んでいます...");

		const response = await page.goto(mediaDetailPath);

		expect(response?.status()).toBe(HTTP_OK);
		await page.evaluate(
			() =>
				new Promise<void>((resolve) => {
					requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
				}),
		);
		expect(hydrationWarnings).toHaveLength(0);

		const reloadResponse = await page.reload();
		expect(reloadResponse?.status()).toBe(HTTP_OK);
		await page.evaluate(
			() =>
				new Promise<void>((resolve) => {
					requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
				}),
		);
		expect(hydrationWarnings).toHaveLength(0);
	});

	test("should not duplicate the initial config query after hydration", async ({
		page,
	}) => {
		const configRequests: Array<{
			method: string;
			postData: string | null;
			url: string;
		}> = [];
		page.on("request", (request) => {
			if (request.url().includes("/api/rpc/config/get")) {
				configRequests.push({
					method: request.method(),
					postData: request.postData(),
					url: request.url(),
				});
			}
		});

		await page.goto("/config", { waitUntil: "load" });
		await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
		await page.evaluate(
			() =>
				new Promise<void>((resolve) => {
					requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
				}),
		);

		expect(configRequests).toHaveLength(1);
	});
});
