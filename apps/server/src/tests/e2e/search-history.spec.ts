import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	mediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const snapshotUrl = /\/search\?search=[0-9a-f-]{36}$/;

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

	await fileNameInput.fill(E2E_PRIMARY_FILE_NAME);
	await fileNameInput.press("Enter");
	await expect(page).toHaveURL(snapshotUrl);
	await expectSearchState(page, E2E_PRIMARY_FILE_NAME);
	const firstSearchUrl = page.url();

	await searchToken(page, E2E_PRIMARY_FILE_NAME).click();
	await fileNameInput.fill(E2E_SIMILAR_FILE_NAME);
	await fileNameInput.press("Enter");
	await expect(page).toHaveURL(snapshotUrl);
	await expect(page).not.toHaveURL(firstSearchUrl);
	await expectSearchState(page, E2E_SIMILAR_FILE_NAME);
	await expect(searchToken(page, E2E_PRIMARY_FILE_NAME)).toHaveCount(0);
	const secondSearchUrl = page.url();

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
