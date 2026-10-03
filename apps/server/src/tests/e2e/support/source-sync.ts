import type { BrowserContext } from "@playwright/test";
import { E2E_SOURCE_NAME, sourcePath } from "./fixture";
import { waitForAppHydration } from "./test";

/** Trigger a real source sync in another tab, preserving the first tab's focus. */
export async function syncFixtureSource(
	context: BrowserContext,
): Promise<void> {
	const syncPage = await context.newPage();
	try {
		await syncPage.setViewportSize({ width: 1440, height: 900 });
		await syncPage.goto(sourcePath());
		await waitForAppHydration(syncPage);
		await syncPage
			.getByRole("button", { name: `${E2E_SOURCE_NAME}の操作`, exact: true })
			.click();
		const syncResponse = syncPage.waitForResponse(
			(response) =>
				new URL(response.url()).pathname === "/api/rpc/sources/sync" &&
				response.ok(),
		);
		await syncPage.getByRole("button", { name: "Sync", exact: true }).click();
		await syncResponse;
	} finally {
		await syncPage.close();
	}
}
