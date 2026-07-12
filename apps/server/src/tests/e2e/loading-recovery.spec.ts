import { E2E_PRIMARY_FILE_NAME, mediaPath } from "./support/fixture";
import { expect, test } from "./support/test";

const searchEndpoint = /\/api\/rpc\/media\/search(?:\?|$)/;
const mediaDetailsEndpoint = /\/api\/rpc\/media\/getDetails(?:\?|$)/;

test.describe("loading and recovery", () => {
	test("keeps the app shell visible while the initial search response is delayed", async ({
		page,
	}) => {
		let releaseRequest: () => void = () => {};
		const requestGate = new Promise<void>((resolve) => {
			releaseRequest = resolve;
		});
		await page.route(searchEndpoint, async (route) => {
			await requestGate;
			await route.continue();
		});

		const navigation = page.goto("/search", { waitUntil: "commit" });
		await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
		await expect(
			page.getByText("検索画面を準備しています...", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("APIの応答を待っています...", { exact: true }),
		).toBeVisible();

		releaseRequest();
		await navigation;
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();
	});

	test("keeps existing results and form input during a background refresh", async ({
		page,
	}) => {
		let holdBackgroundRequest = false;
		let releaseRequest: () => void = () => {};
		const backgroundGate = new Promise<void>((resolve) => {
			releaseRequest = resolve;
		});
		await page.route(searchEndpoint, async (route) => {
			if (holdBackgroundRequest) {
				await backgroundGate;
			}
			await route.continue();
		});

		await page.goto("/search");
		const primaryLink = page.getByRole("link", {
			name: new RegExp(E2E_PRIMARY_FILE_NAME),
		});
		await expect(primaryLink).toBeVisible();

		holdBackgroundRequest = true;
		const searchInput = page.getByPlaceholder("ファイル名を入力...");
		await searchInput.fill(E2E_PRIMARY_FILE_NAME);
		await expect(
			page.getByText("検索結果を更新中...", { exact: true }),
		).toBeVisible();
		await expect(searchInput).toHaveValue(E2E_PRIMARY_FILE_NAME);
		await expect(primaryLink).toBeVisible();

		releaseRequest();
		await expect(
			page.getByText("検索結果を更新中...", { exact: true }),
		).toHaveCount(0);
	});

	test("keeps a media-detail status visible while its initial response is delayed", async ({
		page,
	}) => {
		let releaseRequest: () => void = () => {};
		const requestGate = new Promise<void>((resolve) => {
			releaseRequest = resolve;
		});
		await page.route(mediaDetailsEndpoint, async (route) => {
			await requestGate;
			await route.continue();
		});

		await page.goto(mediaPath(), { waitUntil: "commit" });
		await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
		await expect(
			page.getByText("メディア詳細を準備しています...", { exact: true }),
		).toBeVisible();

		releaseRequest();
		await expect(
			page.getByRole("heading", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
		).toBeVisible();
	});

	for (const failure of ["connectionfailed", "timedout"] as const) {
		test(`shows a recoverable error when search ${failure}`, async ({
			page,
			browserHealth,
		}) => {
			browserHealth.allowRequestFailure("/api/rpc/media/search");
			browserHealth.allowConsole(
				failure === "connectionfailed"
					? "net::ERR_CONNECTION_FAILED"
					: "net::ERR_TIMED_OUT",
			);
			await page.route(searchEndpoint, (route) => route.abort(failure));

			await page.goto("/search");
			await expect(
				page.getByText("検索結果を取得できませんでした", { exact: true }),
			).toBeVisible();

			await page.unroute(searchEndpoint);
			await page.reload();
			await expect(
				page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
			).toBeVisible();
		});
	}

	test("shows a recoverable error when the search service rejects the request", async ({
		page,
		browserHealth,
	}) => {
		browserHealth.allowResponseFailure("/api/rpc/media/search");
		browserHealth.allowConsole(
			"Failed to load resource: the server responded with a status of 503",
		);
		await page.route(searchEndpoint, (route) =>
			route.fulfill({
				status: 503,
				contentType: "text/plain",
				body: "Service Unavailable",
			}),
		);

		await page.goto("/search");
		await expect(
			page.getByText("検索結果を取得できませんでした", { exact: true }),
		).toBeVisible();

		await page.unroute(searchEndpoint);
		await page.reload();
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();
	});

	test("shows and clears the offline API status without replacing existing content", async ({
		page,
	}) => {
		await page.goto("/search");
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();

		await page.evaluate(() => window.dispatchEvent(new Event("offline")));
		await expect(
			page.getByText(
				"APIに接続できません。ネットワーク接続を確認してください。",
				{ exact: true },
			),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
		).toBeVisible();

		await page.evaluate(() => window.dispatchEvent(new Event("online")));
		await expect(
			page.getByText(
				"APIに接続できません。ネットワーク接続を確認してください。",
				{ exact: true },
			),
		).toHaveCount(0);
	});
});
