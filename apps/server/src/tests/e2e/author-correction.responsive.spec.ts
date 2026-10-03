import type { Page } from "@playwright/test";
import {
	E2E_CORRECT_AUTHOR_ID,
	E2E_PRIMARY_MEDIA_ID,
	E2E_PRIMARY_FILE_NAME,
	E2E_WRONG_AUTHOR_ID,
	mediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

async function rpc(page: Page, name: string, input: object) {
	const response = await page.request.post(`/api/rpc/authors/${name}`, {
		data: { json: input },
	});
	expect(response.ok()).toBe(true);
	return response.json() as Promise<{ json: { items?: { id: string }[] } }>;
}
async function openAuthors(page: Page) {
	await page
		.getByRole("button", { name: /作者・外部アカウント/ })
		.filter({ visible: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "作者・外部アカウント", exact: true }),
	).toBeVisible();
}
async function choose(page: Page, label: string, query: string) {
	const input = page.getByRole("combobox", { name: label, exact: true });
	await input.fill(query);
	const option = page.getByRole("option", { name: new RegExp(query) });
	await expect(option).toHaveAttribute(
		"data-key",
		query === "E2E incorrect author"
			? E2E_WRONG_AUTHOR_ID
			: E2E_CORRECT_AUTHOR_ID,
	);
	await option.click();
}

test("author correction preserves coauthors after direct navigation and F5", async ({
	page,
}, testInfo) => {
	const correct = await rpc(page, "listMedia", {
		authorId: E2E_CORRECT_AUTHOR_ID,
	});
	if (correct.json.items?.some((item) => item.id === E2E_PRIMARY_MEDIA_ID)) {
		await rpc(page, "correctMedia", {
			mediaIds: [E2E_PRIMARY_MEDIA_ID],
			sourceAuthorId: E2E_CORRECT_AUTHOR_ID,
			targetAuthorId: E2E_WRONG_AUTHOR_ID,
		});
	}
	await page.goto("/manager");
	await waitForAppHydration(page);
	await openAuthors(page);
	await page.reload();
	await waitForAppHydration(page);
	await openAuthors(page);
	await choose(page, "修正対象の作者", "E2E incorrect author");
	await expect(
		page.getByRole("combobox", { name: "修正対象の作者", exact: true }),
	).toHaveValue(/E2E incorrect author/);
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("link", {
			name: "https://x.com/actual_creator/status/1234567890123456789",
			exact: true,
		}),
	).toBeVisible();
	await choose(page, "正しい作者（修正先）", "E2E correct author");
	await expect(
		page.getByRole("combobox", { name: "修正対象の作者", exact: true }),
	).toHaveValue(/E2E incorrect author/);
	await page
		.getByRole("checkbox", { name: `${E2E_PRIMARY_FILE_NAME}を選択` })
		.press("Space");
	await testInfo.attach("author-management", {
		body: await page.screenshot({ fullPage: true, animations: "disabled" }),
		contentType: "image/png",
	});
	await page
		.getByRole("button", {
			name: "選択したメディアの作者を付け替え",
			exact: true,
		})
		.click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toContainText("ほかの作者の関連付けは維持します");
	await testInfo.attach("author-correction-confirmation", {
		body: await page.screenshot({ fullPage: true, animations: "disabled" }),
		contentType: "image/png",
	});
	await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
	await expect(
		page.getByRole("checkbox", { name: `${E2E_PRIMARY_FILE_NAME}を選択` }),
	).toBeChecked();
	await page
		.getByRole("button", { name: "この作者を修正先に統合", exact: true })
		.click();
	await expect(dialog).toContainText(
		"ソース絞り込みや選択件数に関係なく全件が対象です",
	);
	await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
	await page
		.getByRole("button", {
			name: "選択したメディアの作者を付け替え",
			exact: true,
		})
		.click();
	await dialog
		.getByRole("button", { name: "確認して実行", exact: true })
		.click();
	await expect(
		page.getByText("1件の作者を修正しました。", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("この作者に紐づくメディアはありません。", { exact: true }),
	).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document.documentElement.scrollWidth -
					document.documentElement.clientWidth,
			),
		)
		.toBeLessThanOrEqual(1);
	await page.goto(mediaPath());
	await waitForAppHydration(page);
	await expect(
		page.getByText("E2E correct author", { exact: true }),
	).toBeVisible();
	await expect(page.getByText("E2E coauthor", { exact: true })).toBeVisible();
	await expect(
		page.getByText("E2E incorrect author", { exact: true }),
	).toHaveCount(0);
	await page.reload();
	await waitForAppHydration(page);
	await expect(
		page.getByText("E2E correct author", { exact: true }),
	).toBeVisible();
	// Restore the fixture so other projects and specs start from the same relation.
	await rpc(page, "correctMedia", {
		mediaIds: [E2E_PRIMARY_MEDIA_ID],
		sourceAuthorId: E2E_CORRECT_AUTHOR_ID,
		targetAuthorId: E2E_WRONG_AUTHOR_ID,
	});
});

test("a concurrent correction shows a recoverable conflict and does not silently change the selection", async ({
	page,
	browserHealth,
}) => {
	browserHealth.allowResponseFailure("/api/rpc/authors/correctMedia");
	browserHealth.allowConsole(/409 \(Conflict\)/);
	await page.goto("/manager");
	await waitForAppHydration(page);
	await openAuthors(page);
	await choose(page, "修正対象の作者", "E2E incorrect author");
	await choose(page, "正しい作者（修正先）", "E2E correct author");
	await page
		.getByRole("checkbox", { name: `${E2E_PRIMARY_FILE_NAME}を選択` })
		.press("Space");
	await rpc(page, "correctMedia", {
		mediaIds: [E2E_PRIMARY_MEDIA_ID],
		sourceAuthorId: E2E_WRONG_AUTHOR_ID,
		targetAuthorId: E2E_CORRECT_AUTHOR_ID,
	});
	try {
		await page
			.getByRole("button", {
				name: "選択したメディアの作者を付け替え",
				exact: true,
			})
			.click();
		const dialog = page.getByRole("dialog");
		await dialog
			.getByRole("button", { name: "確認して実行", exact: true })
			.click();
		await expect(dialog.getByRole("alert")).toContainText(
			"作者の関連付けが変更されています",
		);
		await dialog
			.getByRole("button", { name: "キャンセル", exact: true })
			.click();
		await page
			.getByRole("button", { name: "一覧を再取得", exact: true })
			.click();
		await expect(
			page.getByText("この作者に紐づくメディアはありません。", { exact: true }),
		).toBeVisible();
	} finally {
		await rpc(page, "correctMedia", {
			mediaIds: [E2E_PRIMARY_MEDIA_ID],
			sourceAuthorId: E2E_CORRECT_AUTHOR_ID,
			targetAuthorId: E2E_WRONG_AUTHOR_ID,
		});
	}
});

test("author list errors recover without losing the management screen", async ({
	page,
	browserHealth,
}) => {
	browserHealth.allowResponseFailure("/api/rpc/authors/list");
	browserHealth.allowConsole(/503 \(Service Unavailable\)/);
	let failing = true;
	await page.route("**/api/rpc/authors/list", async (route) => {
		if (failing)
			await route.fulfill({
				status: 503,
				contentType: "application/json",
				body: JSON.stringify({ message: "Temporary failure" }),
			});
		else await route.continue();
	});
	await page.goto("/manager");
	await waitForAppHydration(page);
	await openAuthors(page);
	await expect(
		page.getByText("作者一覧を取得できませんでした", { exact: true }),
	).toBeVisible();
	failing = false;
	await page.getByRole("button", { name: /再試行|Retry/ }).click();
	await choose(page, "修正対象の作者", "E2E incorrect author");
	await expect(
		page.getByRole("combobox", { name: "修正対象の作者", exact: true }),
	).toHaveValue(/E2E incorrect author/);
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
});
