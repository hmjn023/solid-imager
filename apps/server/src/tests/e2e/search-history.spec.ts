import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	mediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const snapshotUrl = /\/search\?search=[0-9a-f-]{36}$/;

async function waitForSearchSnapshot(
	page: import("@playwright/test").Page,
	query: string,
): Promise<string> {
	const response = await page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === "/api/rpc/searchSnapshots/capture" &&
			response.ok() &&
			response.request().postDataJSON().json.state.searchQuery === query,
	);
	const { json } = await response.json();
	await expect(page).toHaveURL(new RegExp(`/search\\?search=${json.id}$`));
	return page.url();
}

function searchInput(page: import("@playwright/test").Page) {
	return page.getByRole("combobox", { name: "メディアを検索", exact: true });
}

function searchToken(page: import("@playwright/test").Page, fileName: string) {
	return page.getByRole("button", {
		name: `name:${fileName}を解除`,
		exact: true,
	});
}

async function expectSearchState(
	page: import("@playwright/test").Page,
	fileName: string,
): Promise<void> {
	await expect(searchInput(page)).toHaveValue("");
	await expect(searchToken(page, fileName)).toBeVisible();
	await expect(
		page.getByRole("link", { name: new RegExp(fileName) }),
	).toBeVisible();
}

test("search results remain traversable across detail navigation", async ({
	page,
}) => {
	await page.goto("/search");
	await expect(
		page.getByText("すべてのメディア", { exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);

	const fileNameInput = searchInput(page);

	const firstSnapshot = waitForSearchSnapshot(page, E2E_PRIMARY_FILE_NAME);
	await fileNameInput.fill(E2E_PRIMARY_FILE_NAME);
	await fileNameInput.press("Enter");
	const firstSearchUrl = await firstSnapshot;
	await expectSearchState(page, E2E_PRIMARY_FILE_NAME);

	// Removing the token is itself a settled search state with a history entry.
	const clearedSnapshot = waitForSearchSnapshot(page, "");
	await searchToken(page, E2E_PRIMARY_FILE_NAME).click();
	const clearedSearchUrl = await clearedSnapshot;
	const secondSnapshot = waitForSearchSnapshot(page, E2E_SIMILAR_FILE_NAME);
	await fileNameInput.fill(E2E_SIMILAR_FILE_NAME);
	await fileNameInput.press("Enter");
	const secondSearchUrl = await secondSnapshot;
	await expect(page).not.toHaveURL(firstSearchUrl);
	await expectSearchState(page, E2E_SIMILAR_FILE_NAME);
	await expect(searchToken(page, E2E_PRIMARY_FILE_NAME)).toHaveCount(0);

	const similarResult = page.getByRole("link", {
		name: new RegExp(E2E_SIMILAR_FILE_NAME),
	});
	await similarResult.click();
	await expect(page).toHaveURL(secondSearchUrl);
	await similarResult.dblclick();
	await expect(page).toHaveURL(
		new RegExp(`${mediaPath(E2E_SIMILAR_MEDIA_ID)}/?$`),
	);
	await expect(
		page.getByRole("heading", { name: E2E_SIMILAR_FILE_NAME, exact: true }),
	).toBeVisible();

	await page.goBack();
	await waitForAppHydration(page);
	await expect(page).toHaveURL(secondSearchUrl);
	await expectSearchState(page, E2E_SIMILAR_FILE_NAME);

	await page.goBack();
	await waitForAppHydration(page);
	await expect(page).toHaveURL(clearedSearchUrl);
	await expect(searchToken(page, E2E_PRIMARY_FILE_NAME)).toHaveCount(0);
	await expect(searchToken(page, E2E_SIMILAR_FILE_NAME)).toHaveCount(0);

	await page.goBack();
	await waitForAppHydration(page);
	await expect(page).toHaveURL(firstSearchUrl);
	await expectSearchState(page, E2E_PRIMARY_FILE_NAME);

	// A copied/bookmarked URL has no in-memory history state, so it must restore
	// the same snapshot through the server-side lookup endpoint.
	await page.goto(secondSearchUrl);
	await waitForAppHydration(page);
	await expectSearchState(page, E2E_SIMILAR_FILE_NAME);
	await page.reload();
	await waitForAppHydration(page);
	await expect(page).toHaveURL(secondSearchUrl);
	await expectSearchState(page, E2E_SIMILAR_FILE_NAME);
});

test("preserves submitted search state before immediate navigation", async ({
	page,
}) => {
	await page.goto("/search");
	await expect(
		page.getByText("すべてのメディア", { exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);

	const fileNameInput = searchInput(page);
	await fileNameInput.fill(E2E_PRIMARY_FILE_NAME);
	await fileNameInput.press("Enter");
	await expect(page).toHaveURL(snapshotUrl);

	const primaryResult = page.getByRole("link", {
		name: new RegExp(E2E_PRIMARY_FILE_NAME),
	});
	await expect(primaryResult).toBeVisible();

	await searchToken(page, E2E_PRIMARY_FILE_NAME).click();
	await fileNameInput.fill(E2E_SIMILAR_FILE_NAME);
	await fileNameInput.press("Enter");
	await expect(page).toHaveURL(snapshotUrl);
	await expectSearchState(page, E2E_SIMILAR_FILE_NAME);
	await expect(searchToken(page, E2E_PRIMARY_FILE_NAME)).toHaveCount(0);

	// Leave the current search immediately after submitting its new state.
	await page.getByRole("link", { name: "About", exact: true }).click();
	await expect(page).toHaveURL(/\/about$/);

	await page.goBack();
	await waitForAppHydration(page);
	await expect(page).toHaveURL(snapshotUrl);
	await expectSearchState(page, E2E_SIMILAR_FILE_NAME);
});
