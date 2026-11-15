import { E2E_SOURCE_ID } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("opens a batch, pages past 25 targets and restores its details after reload", async ({
	page,
}) => {
	const filenames = Array.from(
		{ length: 26 },
		(_, i) => `batch-target-${i}.png`,
	);
	const response = await page.request.post("/api/rpc/media/reserveUploads", {
		data: { json: { sourceId: E2E_SOURCE_ID, filenames } },
	});
	expect(response.ok()).toBe(true);
	const {
		json: { jobId },
	} = await response.json();
	await page.goto("/jobs");
	await waitForAppHydration(page);
	await page
		.getByRole("button", { name: new RegExp(jobId) })
		.filter({ visible: true })
		.click();
	await expect(page).toHaveURL(
		(url) => url.searchParams.get("jobId") === jobId,
	);
	const table = page
		.getByRole("table", { name: /バッチの処理対象|Batch targets/i })
		.filter({ visible: true });
	await expect(table.getByRole("row")).toHaveCount(26);
	const firstPage = await table
		.locator("tbody tr td:first-child")
		.allTextContents();
	await page
		.locator("section")
		.filter({ has: table })
		.getByRole("button", { name: /^(次へ|次|Next)$/i })
		.last()
		.click();
	await expect(table.getByRole("row")).toHaveCount(2);
	const last = await table.locator("tbody tr td:first-child").innerText();
	expect([...firstPage, last].sort()).toEqual(filenames.sort());
	await page.reload();
	await waitForAppHydration(page);
	await expect(table.getByRole("row")).toHaveCount(26);
});
