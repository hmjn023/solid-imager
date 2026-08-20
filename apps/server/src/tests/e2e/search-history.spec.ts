import {
	E2E_PRIMARY_FILE_NAME,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	mediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const snapshotUrl = /\/search\?search=[0-9a-f-]{36}$/;

test("search results remain traversable across detail navigation", async ({
	page,
}) => {
	await page.goto("/search");
	await expect(
		page.getByRole("heading", { name: "メディア検索", exact: true }),
	).toBeVisible();
	await waitForAppHydration(page);

	const fileNameInput = page.getByPlaceholder("ファイル名を入力...");
	const searchButton = page.getByRole("button", { name: "検索", exact: true });

	await fileNameInput.fill(E2E_PRIMARY_FILE_NAME);
	await searchButton.click();
	await expect(page).toHaveURL(snapshotUrl);
	await expect(fileNameInput).toHaveValue(E2E_PRIMARY_FILE_NAME);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();
	const firstSearchUrl = page.url();

	await fileNameInput.fill(E2E_SIMILAR_FILE_NAME);
	await searchButton.click();
	await expect(page).toHaveURL(snapshotUrl);
	await expect(page).not.toHaveURL(firstSearchUrl);
	await expect(fileNameInput).toHaveValue(E2E_SIMILAR_FILE_NAME);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible();
	const secondSearchUrl = page.url();

	await page
		.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) })
		.click();
	await expect(page).toHaveURL(
		new RegExp(`${mediaPath(E2E_SIMILAR_MEDIA_ID)}/?$`),
	);
	await expect(
		page.getByRole("heading", { name: E2E_SIMILAR_FILE_NAME, exact: true }),
	).toBeVisible();

	await page.goBack();
	await expect(page).toHaveURL(secondSearchUrl);
	await expect(page.getByPlaceholder("ファイル名を入力...")).toHaveValue(
		E2E_SIMILAR_FILE_NAME,
	);

	await page.goBack();
	await expect(page).toHaveURL(firstSearchUrl);
	await expect(page.getByPlaceholder("ファイル名を入力...")).toHaveValue(
		E2E_PRIMARY_FILE_NAME,
	);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_PRIMARY_FILE_NAME) }),
	).toBeVisible();

	// A copied/bookmarked URL has no in-memory history state, so it must restore
	// the same snapshot through the server-side lookup endpoint.
	await page.goto(secondSearchUrl);
	await waitForAppHydration(page);
	await expect(page.getByPlaceholder("ファイル名を入力...")).toHaveValue(
		E2E_SIMILAR_FILE_NAME,
	);
	await expect(
		page.getByRole("link", { name: new RegExp(E2E_SIMILAR_FILE_NAME) }),
	).toBeVisible();
});
