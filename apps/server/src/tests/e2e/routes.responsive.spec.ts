import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { Page } from "@playwright/test";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SIMILAR_FILE_NAME,
	E2E_SIMILAR_MEDIA_ID,
	E2E_SOURCE_ID,
	E2E_SOURCE_NAME,
	getFixtureMediaPath,
} from "./support/fixture";
import {
	expect,
	expectRouteHealthy,
	test,
	waitForAppHydration,
} from "./support/test";

const sourcePath = `/sources/${E2E_SOURCE_ID}`;
const mediaPath = (mediaId: string) => `${sourcePath}/${mediaId}`;

const run = promisify(execFile);

function expectSeededMediaDump(contents: string): void {
	const records = contents
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
	expect(records).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				id: E2E_PRIMARY_MEDIA_ID,
				fileName: E2E_PRIMARY_FILE_NAME,
			}),
			expect.objectContaining({
				id: E2E_SIMILAR_MEDIA_ID,
				fileName: E2E_SIMILAR_FILE_NAME,
			}),
		]),
	);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
}

test("Workspace routes fit each viewport after hydration", async ({ page }) => {
	const routes = [
		["/search", "すべてのメディア"],
		[sourcePath, E2E_SOURCE_NAME],
		[mediaPath(E2E_PRIMARY_MEDIA_ID), E2E_PRIMARY_FILE_NAME],
		["/manager", "Manager"],
		["/jobs", "Jobs"],
		["/config", "Settings"],
		["/about", "About Solid Imager"],
	] as const;

	for (const [path, visibleText] of routes) {
		await page.goto(path);
		await waitForAppHydration(page);
		await expect(
			page
				.locator("#main-content")
				.getByText(visibleText, { exact: true })
				.first(),
		).toBeVisible();
		await expectRouteHealthy(page);
		await expectNoHorizontalOverflow(page);
	}
});

test("Workspace sidebar keeps navigation items separated in a short viewport", {
	tag: "@desktop-only",
}, async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 480 });
	await page.goto("/search");
	await waitForAppHydration(page);

	const sidebar = page.getByRole("complementary", {
		name: "アプリケーションサイドバー",
	});
	await expect(sidebar).toBeVisible();

	const verticalGaps = await sidebar.evaluate((element) => {
		const links = Array.from(element.querySelectorAll("a"))
			.map((link) => link.getBoundingClientRect())
			.filter((rect) => rect.height > 0)
			.sort((first, second) => first.top - second.top);
		return links.slice(1).map((rect, index) => rect.top - links[index].bottom);
	});

	expect(verticalGaps.length).toBeGreaterThan(0);
	expect(Math.min(...verticalGaps)).toBeGreaterThanOrEqual(0);
});

test("Workspace wide collection uses selection preview before detail navigation", {
	tag: "@desktop-only",
}, async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.goto(sourcePath);
	await waitForAppHydration(page);

	await page.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`).click();
	await expect(page).toHaveURL(new RegExp(`${sourcePath}(?:\\?[^#]*)?$`));
	const inspector = page.getByRole("complementary", {
		name: "選択中のメディア",
	});
	await expect(inspector).toContainText(E2E_PRIMARY_FILE_NAME);
	await page.locator(`[data-media-id="${E2E_SIMILAR_MEDIA_ID}"]`).click();
	await expect(page).toHaveURL(new RegExp(`${sourcePath}(?:\\?[^#]*)?$`));
	await expect(inspector).toContainText(E2E_SIMILAR_FILE_NAME);
	await expect(
		inspector.getByRole("img", { name: E2E_SIMILAR_FILE_NAME, exact: true }),
	).toBeVisible();
	await inspector.getByRole("button", { name: "詳細を開く" }).click();
	await expect(page).toHaveURL(
		new RegExp(`${mediaPath(E2E_SIMILAR_MEDIA_ID)}(?:\\?[^#]*)?$`),
	);
});

test("Workspace restore exposes and selects the TAR format", {
	tag: "@desktop-only",
}, async ({ page }) => {
	await page.goto("/manager");
	await waitForAppHydration(page);

	const categoryNavigation = page.locator(
		'nav[aria-label="Manager categories"]:visible',
	);
	const transferButton = categoryNavigation
		.getByRole("button", { name: /Data transfer/ })
		.first();
	await transferButton.scrollIntoViewIfNeeded();
	await transferButton.click();
	await expect(
		page.getByRole("heading", { name: "Data transfer", exact: true }),
	).toBeVisible();

	const selectTriggers = page.locator('button[aria-haspopup="listbox"]');
	await selectTriggers.nth(0).click();
	await page
		.getByRole("option", { name: E2E_SOURCE_NAME, exact: true })
		.click();

	await selectTriggers.nth(2).click();
	const tarOption = page.getByRole("option", {
		name: "TAR archive",
		exact: true,
	});
	await expect(tarOption).toBeVisible();
	await tarOption.click();
	await expect(selectTriggers.nth(2)).toContainText("TAR archive");
	await expect(page.locator('input[type="file"]')).toHaveAttribute(
		"accept",
		".tar,.zip,application/x-tar,application/zip",
	);
});

test("Workspace Manager export downloads its artifact", {
	tag: "@desktop-only",
}, async ({ page }) => {
	await page.goto("/manager");
	await waitForAppHydration(page);

	const categoryNavigation = page.locator(
		'nav[aria-label="Manager categories"]:visible',
	);
	await categoryNavigation
		.getByRole("button", { name: /Data transfer/ })
		.first()
		.click();

	const selectTriggers = page.locator('button[aria-haspopup="listbox"]');
	await selectTriggers.nth(0).click();
	await page
		.getByRole("option", { name: E2E_SOURCE_NAME, exact: true })
		.click();
	await selectTriggers.nth(1).click();
	await page.getByRole("option", { name: "TAR archive", exact: true }).click();
	await page.getByText("Include original media", { exact: true }).click();
	await expect(
		page.getByRole("checkbox", { name: "Include original media" }),
	).toBeChecked();
	const download = page.waitForEvent("download");
	await page
		.getByRole("button", { name: "Generate & download", exact: true })
		.click();
	const artifact = await download;
	expect(artifact.suggestedFilename()).toMatch(/\.tar$/);
	expect(await artifact.failure()).toBeNull();
	const artifactPath = await artifact.path();
	if (!artifactPath) throw new Error("TAR download did not produce a file");
	const dump = await run("tar", ["-xOf", artifactPath, "dump.ndjson"]);
	expectSeededMediaDump(dump.stdout);
	const image = await run(
		"tar",
		["-xOf", artifactPath, `images/${E2E_PRIMARY_FILE_NAME}`],
		{ encoding: "buffer" },
	);
	expect(image.stdout).toEqual(
		await readFile(getFixtureMediaPath(E2E_PRIMARY_FILE_NAME)),
	);
});

test("Workspace Manager NDJSON export downloads its artifact", {
	tag: "@desktop-only",
}, async ({ page }) => {
	await page.goto("/manager");
	await waitForAppHydration(page);

	const categoryNavigation = page.locator(
		'nav[aria-label="Manager categories"]:visible',
	);
	await categoryNavigation
		.getByRole("button", { name: /Data transfer/ })
		.first()
		.click();

	const selectTriggers = page.locator('button[aria-haspopup="listbox"]');
	await selectTriggers.nth(0).click();
	await page
		.getByRole("option", { name: E2E_SOURCE_NAME, exact: true })
		.click();
	const download = page.waitForEvent("download");
	await page
		.getByRole("button", { name: "Generate & download", exact: true })
		.click();
	const artifact = await download;
	expect(artifact.suggestedFilename()).toMatch(/\.ndjson$/);
	expect(await artifact.failure()).toBeNull();
	const artifactPath = await artifact.path();
	if (!artifactPath) throw new Error("NDJSON download did not produce a file");
	expectSeededMediaDump(await readFile(artifactPath, "utf8"));
});

test("Workspace search filter opens without remounting media results", async ({
	page,
}) => {
	await page.goto("/search");
	await waitForAppHydration(page);

	const firstMedia = page.locator("[data-media-id]").first();
	await expect(firstMedia).toBeVisible();
	await page.evaluate(() => {
		const state = window as Window & {
			__workspaceFirstMedia?: Element;
			__workspaceFilterDialog?: Element;
			__workspaceSawLoadingFallback?: boolean;
			__workspaceLoadingObserver?: MutationObserver;
		};
		state.__workspaceFirstMedia =
			document.querySelector("[data-media-id]") ?? undefined;
		state.__workspaceSawLoadingFallback = false;
		state.__workspaceLoadingObserver = new MutationObserver(() => {
			if (
				document.body.textContent?.includes("画面を読み込んでいます") ||
				document.body.textContent?.includes("検索結果を読み込んでいます")
			) {
				state.__workspaceSawLoadingFallback = true;
			}
		});
		state.__workspaceLoadingObserver.observe(document.body, {
			childList: true,
			subtree: true,
		});
	});

	const filterButton = page.getByRole("button", {
		name: /検索フィルター、\d+件の条件/,
	});
	await filterButton.click();
	const filterDialog = page.getByRole("dialog", { name: "検索フィルター" });
	await expect(filterDialog).toBeVisible();
	await filterDialog.evaluate((element) => {
		(
			window as Window & {
				__workspaceFilterDialog?: Element;
			}
		).__workspaceFilterDialog = element;
	});

	const comboboxNames = await filterDialog
		.getByRole("combobox")
		.evaluateAll((elements) =>
			elements.map((element) => {
				const labelledBy = element.getAttribute("aria-labelledby");
				return (
					element.getAttribute("aria-label") ??
					(labelledBy
						? document.getElementById(labelledBy)?.textContent?.trim()
						: "")
				);
			}),
		);
	expect(comboboxNames.length).toBeGreaterThan(0);
	expect(comboboxNames.every(Boolean)).toBe(true);

	await filterDialog.getByRole("button", { name: "閉じる" }).click();
	await filterButton.click();
	await expect(filterDialog).toBeVisible();
	const renderState = await page.evaluate(() => {
		const state = window as Window & {
			__workspaceFirstMedia?: Element;
			__workspaceFilterDialog?: Element;
			__workspaceSawLoadingFallback?: boolean;
			__workspaceLoadingObserver?: MutationObserver;
		};
		state.__workspaceLoadingObserver?.disconnect();
		return {
			filterNodeWasPreserved:
				state.__workspaceFilterDialog ===
				document.querySelector('[role="dialog"][aria-label="検索フィルター"]'),
			mediaNodeWasPreserved:
				state.__workspaceFirstMedia ===
				document.querySelector("[data-media-id]"),
			sawLoadingFallback: state.__workspaceSawLoadingFallback,
		};
	});
	expect(renderState.filterNodeWasPreserved).toBe(true);
	expect(renderState.mediaNodeWasPreserved).toBe(true);
	expect(renderState.sawLoadingFallback).toBe(false);
});
