import type { Browser } from "@playwright/test";
import { E2E_SOURCE_NAME, sourcePath } from "./fixture";
import { waitForAppHydration } from "./test";

/** Trigger a real source sync as a separate client, preserving the first page's focus. */
export async function syncFixtureSource(
	browser: Browser,
	appUrl: string,
): Promise<void> {
	// Give the second client its own HTTP connection pool. Both clients keep
	// several SSE streams open, which can exhaust one shared HTTP/1.1 pool.
	const syncPage = await browser.newPage({
		baseURL: new URL(appUrl).origin,
		viewport: { width: 1440, height: 900 },
	});
	try {
		await syncPage.goto(sourcePath());
		await waitForAppHydration(syncPage);
		await syncPage
			.getByRole("button", { name: `${E2E_SOURCE_NAME}の操作`, exact: true })
			.click();
		const syncResponse = syncPage.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === "/api/sources/sync" &&
				response.ok(),
		);
		await syncPage.getByRole("menuitem", { name: "同期", exact: true }).click();
		await syncResponse;
	} finally {
		await syncPage.close();
	}
}
