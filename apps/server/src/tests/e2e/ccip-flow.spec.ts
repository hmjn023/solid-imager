import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	mediaPath,
	sourcePath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const startCcipExtractionEndpoint =
	/\/api\/rpc\/ai\/startCcipExtraction(?:\?|$)/;
const ccipVectorStatusEndpoint = /\/api\/rpc\/ai\/ccipVectorStatus(?:\?|$)/;
const jobEventsEndpoint = /\/api\/rpc\/jobs\/events(?:\?|$)/;

test("extracts real CCIP vectors and finds a similar seeded image", async ({
	page,
	browserHealth,
}) => {
	test.setTimeout(180_000);
	// The test intentionally aborts the browser request after the server has
	// accepted it, in order to reload while extraction remains pending.
	browserHealth.allowRequestFailure(startCcipExtractionEndpoint);

	let releaseStartRequest: () => void = () => {};
	const startRequestGate = new Promise<void>((resolve) => {
		releaseStartRequest = resolve;
	});
	await page.route(startCcipExtractionEndpoint, async (route) => {
		await startRequestGate;
		await route.continue();
	});

	const jobEventsConnected = page.waitForResponse(
		(response) =>
			jobEventsEndpoint.test(new URL(response.url()).pathname) &&
			response.status() === 200,
		{ timeout: 30_000 },
	);
	const initialStatusResponse = page.waitForResponse(
		(response) =>
			ccipVectorStatusEndpoint.test(new URL(response.url()).pathname),
		{ timeout: 30_000 },
	);
	await page.goto(mediaPath(E2E_SIMILAR_MEDIA_ID));
	await initialStatusResponse;
	await jobEventsConnected;

	let releaseStatusRequest: () => void = () => {};
	const statusRequestGate = new Promise<void>((resolve) => {
		releaseStatusRequest = resolve;
	});
	let markPostSubmitStatusRequest: () => void = () => {};
	const postSubmitStatusRequest = new Promise<void>((resolve) => {
		markPostSubmitStatusRequest = resolve;
	});
	await page.route(ccipVectorStatusEndpoint, async (route) => {
		markPostSubmitStatusRequest();
		await statusRequestGate;
		await route.continue();
	});

	const moreActions = page.getByRole("button", {
		name: "More actions",
		exact: true,
	});
	await moreActions.click();
	await page
		.getByRole("button", { name: "Extract CCIP vector", exact: true })
		.click();
	releaseStartRequest();
	await postSubmitStatusRequest;
	await moreActions.click();
	await expect(
		page.getByRole("button", {
			name: "Extracting CCIP vector…",
			exact: true,
		}),
	).toBeDisabled();
	releaseStatusRequest();
	await expect(
		page.getByRole("button", {
			name: "Re-extract CCIP vector",
			exact: true,
		}),
	).toBeEnabled({ timeout: 90_000 });

	await page.unroute(startCcipExtractionEndpoint);
	await page.unroute(ccipVectorStatusEndpoint);

	let markQueuedExtraction: () => void = () => {};
	const queuedExtraction = new Promise<void>((resolve) => {
		markQueuedExtraction = resolve;
	});
	let abortPendingBrowserRequest: () => void = () => {};
	const pendingBrowserRequest = new Promise<void>((resolve) => {
		abortPendingBrowserRequest = resolve;
	});
	await page.route(startCcipExtractionEndpoint, async (route) => {
		// Queue the real job, but hold its response so F5 happens while this
		// client still considers extraction pending. This reproduces the original
		// stale-status regression without faking the server-side CCIP work.
		await route.fetch();
		markQueuedExtraction();
		await pendingBrowserRequest;
		await route.abort("aborted");
	});

	await page.goto(mediaPath(E2E_PRIMARY_MEDIA_ID));
	await moreActions.click();
	await page
		.getByRole("button", { name: "Extract CCIP vector", exact: true })
		.click();
	await queuedExtraction;
	const reload = page.reload();
	abortPendingBrowserRequest();
	await reload;
	await moreActions.click();
	await expect(
		page.getByRole("button", {
			name: "Re-extract CCIP vector",
			exact: true,
		}),
	).toBeEnabled({ timeout: 90_000 });
	await expect(
		page.getByRole("button", { name: "Find similar", exact: true }),
	).toBeEnabled();

	const similarityResponse = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === "/api/rpc/media/searchSimilar" &&
			response.status() === 200,
	);
	await page.getByRole("button", { name: "Find similar", exact: true }).click();
	await similarityResponse;

	await expect(page).toHaveURL(/\/search(?:\?.*)?$/);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible({
		timeout: 30_000,
	});
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toHaveCount(0);

	await page.goto(sourcePath());
	await waitForAppHydration(page);
	await expect(page.getByText(/^\d+ items$/)).toBeVisible();
	const primaryMedia = page.locator(
		`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`,
	);
	await expect(primaryMedia).toBeVisible();
	await primaryMedia.click({ button: "right" });
	const directSearchResponse = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === "/api/rpc/media/searchSimilar" &&
			response.status() === 200,
		{ timeout: 30_000 },
	);
	await page.getByRole("menuitem", { name: "類似度検索", exact: true }).click();
	await directSearchResponse;
	await expect(page).toHaveURL(/\/search(?:\?.*)?$/);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible({ timeout: 30_000 });
});
