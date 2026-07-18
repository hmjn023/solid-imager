import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	mediaPath,
} from "./support/fixture";
import { expect, test } from "./support/test";

const startCcipExtractionEndpoint =
	/\/api\/rpc\/ai\/startCcipExtraction(?:\?|$)/;
const ccipVectorStatusEndpoint = /\/api\/rpc\/ai\/ccipVectorStatus(?:\?|$)/;

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

	const initialStatusResponse = page.waitForResponse((response) =>
		ccipVectorStatusEndpoint.test(new URL(response.url()).pathname),
	);
	await page.goto(mediaPath(E2E_SIMILAR_MEDIA_ID));
	await initialStatusResponse;

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

	await page
		.getByRole("button", { name: "Extract CCIP Vector", exact: true })
		.click();
	await expect(
		page.getByRole("button", {
			name: "Extract CCIP Vector",
			exact: true,
		}),
	).toBeDisabled();
	releaseStartRequest();
	await postSubmitStatusRequest;
	await expect(
		page.getByRole("button", {
			name: "Extracting CCIP Vector...",
			exact: true,
		}),
	).toBeDisabled();
	releaseStatusRequest();
	await expect(
		page.getByRole("button", {
			name: "Re-extract CCIP Vector",
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
	await page
		.getByRole("button", { name: "Extract CCIP Vector", exact: true })
		.click();
	await queuedExtraction;
	const reload = page.reload();
	abortPendingBrowserRequest();
	await reload;
	await expect(
		page.getByRole("button", {
			name: "Re-extract CCIP Vector",
			exact: true,
		}),
	).toBeEnabled({ timeout: 90_000 });
	await expect(
		page.getByRole("button", { name: "Find Similar", exact: true }),
	).toBeVisible();

	const similarityResponse = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === "/api/rpc/media/searchSimilar" &&
			response.status() === 200,
	);
	await page.getByRole("button", { name: "Find Similar", exact: true }).click();
	await similarityResponse;

	await expect(page).toHaveURL(/\/search$/);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible({ timeout: 30_000 });
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toHaveCount(0);
});
