import type { Page } from "@playwright/test";
import {
	authorSchema,
	authorAccountVerificationSchema,
} from "@solid-imager/core/domain/authors/schemas";
import { expect, test, waitForAppHydration } from "./support/test";

async function rpc(page: Page, name: string, input: object = {}) {
	const response = await page.request.post(`/api/rpc/authors/${name}`, {
		data: { json: input },
	});
	expect(response.ok()).toBe(true);
	const body: unknown = await response.json();
	if (!body || typeof body !== "object" || !("json" in body))
		throw new Error("Invalid RPC result");
	return body.json;
}

for (const withAccount of [true, false]) {
	test(`current username preview ${withAccount ? "updates legacy account" : "attaches missing account"}, requires confirmation and follows renames after F5`, async ({
		page,
		browserHealth,
	}, testInfo) => {
		const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
		const oldHandle = `old_${suffix}`;
		const currentHandle = `now_${suffix}`;
		const remoteId = `${Date.now()}${Number.parseInt(suffix, 16)}`;
		const name = `E2E verify ${suffix}`;
		const author = authorSchema.parse(
			await rpc(page, "create", {
				name: `Legacy display ${suffix}`,
				accountId: withAccount ? oldHandle : undefined,
			}),
		);
		await rpc(page, "updateName", { id: author.id, name });
		await page.goto("/manager");
		await waitForAppHydration(page);
		await page
			.getByRole("button", { name: /作者・外部アカウント/ })
			.filter({ visible: true })
			.click();
		await page
			.getByRole("combobox", { name: "修正対象の作者", exact: true })
			.fill(name);
		await page.getByRole("option", { name: new RegExp(name) }).click();
		await page
			.getByRole("textbox", { name: "現在のXユーザー名", exact: true })
			.fill(`@${currentHandle}`);
		await page
			.getByRole("button", { name: "プロフィールを取得して確認", exact: true })
			.click();
		const dialog = page.getByRole("dialog");
		const update = dialog.getByRole("button", {
			name: "同じアカウントと確認して更新",
			exact: true,
		});
		await expect(update).toBeDisabled();
		await expect(
			dialog.getByText("Xプロフィールからの取得を待っています...", {
				exact: true,
			}),
		).toBeVisible();
		const href = await dialog
			.getByRole("link", { name: "Xプロフィールを開いて取得", exact: true })
			.getAttribute("href");
		if (!href) throw new Error("Missing verification URL");
		const verificationId = new URLSearchParams(new URL(href).hash.slice(1)).get(
			"solid-imager-account-verification",
		);
		if (!verificationId) throw new Error("Missing verification token");
		// Exercise the real xtracter callback API; no live X account or personal database is involved.
		await rpc(page, "submitAccountVerification", {
			verificationId,
			profile: {
				username: currentHandle,
				remoteId,
				displayName: "Observed display",
			},
		});
		await expect(
			dialog.getByText("Observed display", { exact: true }),
		).toBeVisible();
		await expect(update).toBeDisabled();
		const pending = authorAccountVerificationSchema.parse(
			await rpc(page, "getAccountVerification", { verificationId }),
		);
		expect(pending.confirmed).toBe(false);
		const before = authorSchema.array().parse(await rpc(page, "list"));
		expect(
			before.find((item) => item.id === author.id)?.accounts?.[0]?.remoteId ??
				null,
		).toBeNull();
		await testInfo.attach("account-verification-preview", {
			body: await page.screenshot({ animations: "disabled", fullPage: true }),
			contentType: "image/png",
		});
		await dialog
			.getByRole("checkbox", {
				name: "元の作者と同じアカウントであることを確認しました",
				exact: true,
			})
			.press("Space");
		// A failed save preserves the preview and confirmation so the same operation can be retried.
		browserHealth.allowResponseFailure(
			"/api/rpc/authors/confirmAccountVerification",
		);
		browserHealth.allowConsole(/503 \(Service Unavailable\)/);
		await page.route("**/api/rpc/authors/confirmAccountVerification", (route) =>
			route.fulfill({
				status: 503,
				contentType: "application/json",
				body: JSON.stringify({
					json: {
						code: "SERVICE_UNAVAILABLE",
						message: "E2E temporary failure",
					},
				}),
			}),
		);
		await update.click();
		await expect(dialog.getByRole("alert")).toBeVisible();
		await expect(dialog.getByRole("checkbox")).toBeChecked();
		await page.unroute("**/api/rpc/authors/confirmAccountVerification");
		// The save can be retried without another profile request.
		await update.click();
		await expect(dialog).toHaveCount(0);
		await expect(
			page.getByText("固定ID確認済み・以降の取り込み時に自動更新", {
				exact: true,
			}),
		).toBeVisible();
		const after = authorSchema.array().parse(await rpc(page, "list"));
		expect(
			after.find((item) => item.id === author.id)?.accounts?.[0],
		).toMatchObject({
			remoteId,
			accountId: currentHandle,
			platform: "twitter",
		});
		const renamed = authorSchema.parse(
			await rpc(page, "create", {
				name: "Next display",
				platform: "twitter",
				accountId: `next_${suffix}`,
				remoteId,
				observedAt: new Date(Date.now() + 1000).toISOString(),
			}),
		);
		expect(renamed.id).toBe(author.id);
		await page.reload();
		await waitForAppHydration(page);
		await page
			.getByRole("button", { name: /作者・外部アカウント/ })
			.filter({ visible: true })
			.click();
		await page
			.getByRole("combobox", { name: "修正対象の作者", exact: true })
			.fill(name);
		await page.getByRole("option", { name: new RegExp(name) }).click();
		await expect(
			page.getByRole("textbox", { name: "現在のXユーザー名", exact: true }),
		).toHaveValue(`next_${suffix}`);
		await expect(
			page.getByText("固定ID確認済み・以降の取り込み時に自動更新", {
				exact: true,
			}),
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
	});
}
