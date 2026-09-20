import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
	E2E_SOURCE_NAME,
} from "./support/fixture";
import { expect, expectRouteHealthy, test } from "./support/test";

const sourcePath = `/sources/${E2E_SOURCE_ID}`;
const mediaPath = `${sourcePath}/${E2E_PRIMARY_MEDIA_ID}`;

type PendingImportJob = {
	id: string;
	item?: { targetUrl?: string };
};

function tauriPath(route: string): string {
	const normalized = route.startsWith("/") ? route : `/${route}`;
	return `/#${normalized}`;
}

async function waitForTauriWorkspace(page: Page): Promise<void> {
	await expect(page.locator('[data-design="workspace"]')).toBeVisible();
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			}),
	);
}

async function openTauriRoute(page: Page, route: string): Promise<void> {
	await page.goto(tauriPath(route));
	await waitForTauriWorkspace(page);
}

async function reloadTauriRoute(page: Page): Promise<void> {
	// The desktop client keeps event streams open while a route reloads. Leave
	// the document first so route assertions cannot match the outgoing app, then
	// open the saved hash route as a fresh document.
	const url = page.url();
	await page.goto("about:blank");
	await page.goto(url, { waitUntil: "domcontentloaded" });
	await waitForTauriWorkspace(page);
}

async function expectTauriMediaDetail(page: Page): Promise<void> {
	// The hash router commits the URL before the lazy detail route has mounted.
	// Wait for the detail header before asserting viewer content so this check
	// exercises the rendered route rather than the previous screen's image.
	await expect(
		page.getByRole("button", { name: "一覧に戻る", exact: true }),
	).toBeVisible();
	const viewer = page.locator("[data-media-viewer]");
	await expect(viewer).toBeVisible();
	await expect(
		viewer
			.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true })
			.or(viewer.getByText(E2E_PRIMARY_FILE_NAME, { exact: true })),
	).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

async function captureTauriScreenshot(page: Page, name: string): Promise<void> {
	const screenshotDirectory = path.join(tmpdir(), "solid-imager-tauri-e2e");
	await mkdir(screenshotDirectory, { recursive: true });
	const mode = process.env.E2E_MODE ?? "unknown";
	await page.screenshot({
		fullPage: true,
		path: path.join(screenshotDirectory, `${mode}-${name}.png`),
	});
}

async function expectWorkspaceShell(page: Page): Promise<void> {
	const workspace = page.locator('[data-design="workspace"]');
	await expect(workspace).toBeVisible();
	await expect(
		workspace.getByRole("link", { name: "Solid Imager Library", exact: true }),
	).toBeVisible();
	await expect(
		workspace.getByRole("navigation", { name: "主要ナビゲーション" }),
	).toBeVisible();
	await expectNoHorizontalOverflow(page);
}

test("Tauri root opens the real shared Library workspace", async ({ page }) => {
	await page.goto("/");
	await waitForTauriWorkspace(page);
	await expect(page).toHaveURL(/\/#\/search(?:\?.*)?$/);
	await expectWorkspaceShell(page);
	await expect(
		page.getByRole("link", { name: "Library", exact: true }),
	).toHaveAttribute("aria-current", "page");
	const skipLink = page.getByRole("button", {
		name: "メインコンテンツへ移動",
	});
	await skipLink.focus();
	await skipLink.press("Enter");
	await expect(page.locator("#main-content")).toBeFocused();
	await expect(page).toHaveURL(/\/#\/search(?:\?.*)?$/);
	await expect(
		page.getByText("すべてのメディア", { exact: true }),
	).toBeVisible();
	await expect(
		page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`),
	).toBeVisible();
	await expect(
		page.getByText(
			"Standalone routes are now interactive enough for navigation checks.",
			{
				exact: false,
			},
		),
	).toHaveCount(0);
	await expectRouteHealthy(page);
});

test("Tauri Library separates preview selection from current media detail", async ({
	page,
}) => {
	await openTauriRoute(page, "/search");
	await expectWorkspaceShell(page);

	const searchInput = page.getByRole("combobox", {
		name: "メディアを検索",
		exact: true,
	});
	await expect(searchInput).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: "検索フィルター、0件の条件",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "グリッド表示", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "リスト表示", exact: true }),
	).toBeVisible();

	const media = page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`);
	await expect(media).toBeVisible();
	await media.click();
	await expect(page).toHaveURL(/\/#\/search(?:\?.*)?$/);
	await expect(media).toHaveAttribute("aria-current", "true");
	const inspector = page.getByRole("complementary", {
		name: "選択中のメディア",
	});
	await expect(inspector).toBeVisible();
	await expect(inspector).toContainText(E2E_PRIMARY_FILE_NAME);
	await captureTauriScreenshot(page, "search");

	// `window.open` is emitted on the context even when Chromium does not
	// classify the child as a popup. Keep a bounded wait so a blocked new tab
	// cannot leave this migration suite running indefinitely.
	const popupPromise = page.context().waitForEvent("page", { timeout: 15_000 });
	await media.click({ button: "right" });
	await page
		.getByRole("menuitem", { name: "新しいタブで開く", exact: true })
		.click();
	const popup = await popupPromise;
	await waitForTauriWorkspace(popup);
	await expect(popup).toHaveURL(new RegExp(`/#${mediaPath}$`));
	await expectTauriMediaDetail(popup);
	await popup.close();

	await media.dblclick();
	await expect(page).toHaveURL(new RegExp(`/#${mediaPath}$`));
	await expectTauriMediaDetail(page);
	await captureTauriScreenshot(page, "detail");

	const detailUrl = page.url();
	await reloadTauriRoute(page);
	await expect(page).toHaveURL(detailUrl);
	await expectTauriMediaDetail(page);
	await expectRouteHealthy(page);
});

test("Tauri source route reloads and exposes source and import dialogs", async ({
	page,
}) => {
	await openTauriRoute(page, "/sources/");
	await expect(page).toHaveURL(/\/#\/search(?:\?.*)?$/);

	await openTauriRoute(page, sourcePath);
	await expectWorkspaceShell(page);
	await expect(
		page.getByText(E2E_SOURCE_NAME, { exact: true }).first(),
	).toBeVisible();
	const sourceMedia = page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`);
	await expect(sourceMedia).toBeVisible();
	await sourceMedia.press("Enter");
	await expect(page).toHaveURL(new RegExp(`/#${mediaPath}$`));
	await expectTauriMediaDetail(page);
	await reloadTauriRoute(page);
	await expect(page).toHaveURL(new RegExp(`/#${mediaPath}$`));
	await expectTauriMediaDetail(page);

	await openTauriRoute(page, "/search");
	const addSource = page.getByRole("button", {
		name: "Add source",
		exact: true,
	});
	await expect(addSource).toBeVisible();
	await addSource.click();
	const addDialog = page.getByRole("dialog");
	await expect(
		addDialog.getByRole("heading", { name: "Add New Source", exact: true }),
	).toBeVisible();
	await expect(addDialog.getByLabel("Name", { exact: true })).toBeVisible();
	await addDialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(addDialog).toHaveCount(0);

	const sourceActions = page.getByRole("button", {
		name: `${E2E_SOURCE_NAME}の操作`,
		exact: true,
	});
	await sourceActions.click();
	await page.getByRole("button", { name: "Edit", exact: true }).click();
	const editDialog = page.getByRole("dialog");
	await expect(
		editDialog.getByRole("heading", { name: "Edit Source", exact: true }),
	).toBeVisible();
	await editDialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(editDialog).toHaveCount(0);

	const pendingImportUrl = new URL(
		`/api/sources/${E2E_SOURCE_ID}/${E2E_PRIMARY_MEDIA_ID}`,
		page.url(),
	).toString();
	const addImportResponse = await page.request.post(
		"/api/rpc/imports/bulkAdd",
		{
			data: {
				json: {
					items: [{ targetUrl: pendingImportUrl }],
				},
			},
		},
	);
	expect(addImportResponse.ok()).toBeTruthy();
	const listImportResponse = await page.request.post(
		"/api/rpc/imports/listPending",
		{ data: { json: null } },
	);
	expect(listImportResponse.ok()).toBeTruthy();
	const listPayload = (await listImportResponse.json()) as {
		json?: unknown;
	};
	const pendingJobs = Array.isArray(listPayload.json)
		? (listPayload.json as PendingImportJob[])
		: [];
	const pendingJob = pendingJobs.find(
		(job) => job.item?.targetUrl === pendingImportUrl,
	);
	if (!pendingJob) {
		throw new Error(
			`The isolated imports API did not return ${pendingImportUrl} as pending`,
		);
	}

	try {
		await reloadTauriRoute(page);
		const importButton = page.getByRole("button", { name: /Import inbox/ });
		await expect(importButton).toBeEnabled();
		await importButton.click();
		const importDialog = page.getByRole("dialog").filter({
			has: page.getByRole("heading", { name: "Import inbox", exact: true }),
		});
		await expect(importDialog).toBeVisible();
		await expect(importDialog).toContainText(pendingImportUrl);
		await importDialog
			.getByRole("button", { name: "Close", exact: true })
			.click();
		await expect(importDialog).toHaveCount(0);
	} finally {
		const cancelImportResponse = await page.request.post(
			"/api/rpc/imports/cancel",
			{ data: { json: { jobIds: [pendingJob.id] } } },
		);
		expect(cancelImportResponse.ok()).toBeTruthy();
	}
	await expectRouteHealthy(page);
});

test("Tauri Manager, Settings, and Servers use current shared layouts", async ({
	browserHealth,
	page,
}) => {
	await openTauriRoute(page, "/manager");
	await expectWorkspaceShell(page);
	await expect(
		page.getByRole("heading", { name: "Manager", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Entity Manager", exact: true }),
	).toHaveCount(0);
	await expect(
		page.locator('nav[aria-label="Manager categories"]:visible'),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: /^Batch tagging/ }),
	).toBeVisible();
	await captureTauriScreenshot(page, "manager");

	await openTauriRoute(page, "/config");
	await expectWorkspaceShell(page);
	await expect(
		page.getByRole("heading", { name: "Settings", exact: true }),
	).toBeVisible();
	await page.getByRole("tab", { name: /^AI/ }).click();
	await expect(
		page.getByRole("group", { name: "AI Service", exact: true }),
	).toBeVisible();
	await expect(
		page.getByLabel("Remote AI Server URL (oRPC)", { exact: true }),
	).toBeVisible();
	const checkAiButton = page.getByRole("button", {
		name: "Check now",
		exact: true,
	});
	await expect(checkAiButton).toBeVisible();
	const healthCheckpoint = browserHealth.requestCheckpoint();
	await checkAiButton.click();
	await expect
		.poll(() =>
			browserHealth.apiRequestCountPathSince(
				healthCheckpoint,
				"/api/rpc/ai/health",
			),
		)
		.toBe(1);
	await expect(
		page.getByText(/service available|AI service unavailable/i).first(),
	).toBeVisible();

	await openTauriRoute(page, "/search");
	const serverLink = page.getByRole("link", {
		name: "Server connections",
		exact: true,
	});
	await expect(serverLink).toBeVisible();
	await serverLink.click();
	await waitForTauriWorkspace(page);
	await expect(page).toHaveURL(/\/#\/servers$/);

	await openTauriRoute(page, "/servers");
	await expectWorkspaceShell(page);
	await expect(
		page.getByRole("heading", { name: /Server connections/i, exact: true }),
	).toBeVisible();
	await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
	await expect(page.getByLabel("Server URL", { exact: true })).toBeVisible();
	await expectRouteHealthy(page);
});
