import { routeApi } from "./support/api";
import type { Page } from "@playwright/test";
import { mediaContentPath } from "@solid-imager/core/http";
import {
	E2E_PRIMARY_FILE_NAME,
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
	E2E_SOURCE_NAME,
	mediaPath,
} from "./support/fixture";
import { withRelatedMediaTag } from "./support/related-media-fixture";
import { expect, test, waitForAppHydration } from "./support/test";

async function openImageViewer(page: Page) {
	await page.goto(mediaPath());
	await waitForAppHydration(page);
	await page
		.getByRole("button", {
			name: `${E2E_PRIMARY_FILE_NAME}の画像ビューアーを開く`,
			exact: true,
		})
		.click();
	const dialog = page.getByRole("dialog", {
		name: E2E_PRIMARY_FILE_NAME,
		exact: true,
	});
	await expect(dialog).toBeVisible();
	return dialog;
}

test("IME confirmation does not execute a command palette action", async ({
	page,
}) => {
	await page.goto("/search");
	await waitForAppHydration(page);
	await page.getByRole("button", { name: "クイック操作", exact: true }).click();
	const palette = page.getByRole("dialog", {
		name: "クイック操作",
		exact: true,
	});
	const input = palette.getByRole("combobox", { name: "クイック操作を検索" });
	await input.fill("統計");
	for (const composition of [{ isComposing: true }, { keyCode: 229 }]) {
		await input.dispatchEvent("keydown", {
			key: "Enter",
			code: "Enter",
			...composition,
		});
		await expect(palette).toBeVisible();
		await expect(input).toHaveValue("統計");
		await expect(page).toHaveURL(/\/search(?:\?search=[0-9a-f-]+)?$/);
	}
	await input.press("Enter");
	await expect(palette).toBeHidden();
	await expect(page).toHaveURL(/\/statistics$/);
});

test("IME confirmation preserves the search draft and focused suggestions", async ({
	page,
}) => {
	await withRelatedMediaTag(page.request, async () => {
		await page.goto("/search");
		await waitForAppHydration(page);
		const input = page.getByRole("combobox", {
			name: "メディアを検索",
			exact: true,
		});
		await input.fill("日本語");
		for (const composition of [{ isComposing: true }, { keyCode: 229 }]) {
			await input.dispatchEvent("keydown", {
				key: "Enter",
				code: "Enter",
				...composition,
			});
			await expect(input).toHaveValue("日本語");
			await expect(
				page.getByRole("button", { name: "name:日本語を解除", exact: true }),
			).toHaveCount(0);
		}
		await input.fill("tag:Related");
		await expect(page.getByRole("option").first()).toBeVisible();
		await input.press("ArrowDown");
		await expect(input).toHaveAttribute("aria-activedescendant", /.+/);
		for (const composition of [{ isComposing: true }, { keyCode: 229 }]) {
			await input.dispatchEvent("keydown", {
				key: "Enter",
				code: "Enter",
				...composition,
			});
			await expect(input).toHaveValue("tag:Related");
			await expect(page.getByRole("option").first()).toBeVisible();
		}
		await input.press("Enter");
		await expect(input).toHaveValue("");
		await expect(
			page.getByRole("button", { name: /^tag:Related tag .+を解除$/ }),
		).toBeVisible();
	});
});

test("image viewer toolbar roves focus while the image supports panning", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const dialog = await openImageViewer(page);
	const stage = dialog.locator("[data-media-viewer-pan-handle]");
	const image = dialog.getByRole("img", {
		name: E2E_PRIMARY_FILE_NAME,
		exact: true,
	});
	const toolbar = dialog.getByRole("toolbar", { name: "画像のズーム操作" });
	const zoomIn = toolbar.getByRole("button", { name: "拡大", exact: true });
	const zoomOut = toolbar.getByRole("button", { name: "縮小", exact: true });
	const reset = toolbar.getByRole("button", { name: "画面に合わせる" });
	const fullscreen = toolbar.getByRole("button", {
		name: "全画面表示",
		exact: true,
	});
	await expect(toolbar.locator('button[tabindex="0"]')).toHaveCount(1);
	await stage.focus();
	await page.keyboard.press("Tab");
	await expect(toolbar.locator(":focus")).toHaveCount(1);
	await page.keyboard.press("Tab");
	await expect(toolbar.locator(":focus")).toHaveCount(0);
	await page.keyboard.press("Shift+Tab");
	await expect(toolbar.locator(":focus")).toHaveCount(1);

	await reset.focus();
	await page.keyboard.press("ArrowLeft");
	await expect(zoomOut).toBeFocused();
	await expect(zoomOut).toHaveAttribute("aria-disabled", "true");
	await page.keyboard.press("Space");
	await expect(reset).toHaveText("100%");
	await page.keyboard.press("ArrowRight");
	await expect(reset).toBeFocused();
	await page.keyboard.press("ArrowRight");
	await expect(zoomIn).toBeFocused();
	await page.keyboard.press("Space");
	await expect(reset).toHaveText("125%");
	await page.keyboard.press("ArrowRight");
	await expect(fullscreen).toBeFocused();
	await page.keyboard.press("ArrowLeft");
	await expect(zoomIn).toBeFocused();
	await page.keyboard.press("ArrowDown");
	await expect(zoomIn).toBeFocused();
	await expect(image).toHaveCSS("--media-pan-x", "0px");
	await expect(image).toHaveCSS("--media-pan-y", "0px");

	for (let step = 0; step < 3; step++) {
		await zoomIn.click();
	}
	await stage.focus();
	await expect(stage).toBeFocused();
	await stage.press("ArrowRight");
	await expect
		.poll(() =>
			image.evaluate((element) =>
				Number.parseFloat(element.style.getPropertyValue("--media-pan-x")),
			),
		)
		.toBeGreaterThan(0);
	await stage.press("ArrowDown");
	await expect
		.poll(() =>
			image.evaluate((element) =>
				Number.parseFloat(element.style.getPropertyValue("--media-pan-y")),
			),
		)
		.toBeGreaterThan(0);
	await reset.click();
	for (let step = 0; step < 4; step++) {
		await zoomIn.click();
	}
	await dialog
		.getByRole("button", { name: "画像を左へ移動", exact: true })
		.click();
	await expect
		.poll(() =>
			image.evaluate((element) =>
				Number.parseFloat(element.style.getPropertyValue("--media-pan-x")),
			),
		)
		.toBeLessThan(0);
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await expect(
		page.getByRole("button", {
			name: `${E2E_PRIMARY_FILE_NAME}の画像ビューアーを開く`,
			exact: true,
		}),
	).toBeFocused();
	await page.reload();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("img", { name: E2E_PRIMARY_FILE_NAME, exact: true }),
	).toBeVisible();
});

test("reduced motion suppresses image transitions and popover scaling", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const dialog = await openImageViewer(page);
	await dialog.getByRole("button", { name: "拡大", exact: true }).click();
	const image = dialog.getByRole("img", {
		name: E2E_PRIMARY_FILE_NAME,
		exact: true,
	});
	await expect(image).toHaveCSS("transition-duration", "0s");
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await expect(image).toHaveCSS("transition-duration", "0.15s");
	await page.keyboard.press("Escape");
	const actions = page.getByRole("button", {
		name: "その他の操作",
		exact: true,
	});
	await actions.click({ trial: true });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await actions.click();
	const menu = page.getByRole("menu");
	await expect(
		menu.getByRole("menuitem", { name: "原本をダウンロード", exact: true }),
	).toBeVisible();
	const scale = await menu.evaluate((element) => {
		const style = getComputedStyle(element);
		return [
			style.getPropertyValue("--tw-enter-scale"),
			style.getPropertyValue("--tw-exit-scale"),
		];
	});
	expect(
		scale.every((value) => !value.trim() || Number(value.trim()) === 1),
	).toBe(true);
});

test("manager source and format selectors expose their visible labels", async ({
	page,
}) => {
	await page.goto("/manager");
	await waitForAppHydration(page);
	const navigation = page.locator('nav[aria-label="管理カテゴリ"]:visible');
	await navigation.getByRole("button", { name: /データ転送/ }).click();
	const target = page.getByRole("combobox", { name: /^保存先ソース/ });
	await expect(target).toBeVisible();
	await expect(
		page.getByRole("combobox", { name: /^エクスポート形式/ }),
	).toBeVisible();
	await expect(page.getByRole("combobox", { name: /^復元形式/ })).toBeVisible();
	await target.click();
	await page
		.getByRole("option", { name: E2E_SOURCE_NAME, exact: true })
		.click();
	await expect(target).toHaveAccessibleName(/^保存先ソース/);
	await expect(target).toContainText(E2E_SOURCE_NAME);
	for (const category of ["一括タグ付け", "サムネイル", "重複検出"]) {
		await navigation
			.getByRole("button", { name: new RegExp(category) })
			.click();
		await expect(
			page.getByRole("combobox", { name: /^対象ソース/ }),
		).toBeVisible();
	}
});

test("media content supports byte ranges and HEAD in the serving runtime", async ({
	request,
}) => {
	const url = mediaContentPath(E2E_SOURCE_ID, E2E_PRIMARY_MEDIA_ID);
	const head = await request.head(url);
	expect(head.status()).toBe(200);
	expect(await head.body()).toHaveLength(0);
	const size = Number(head.headers()["content-length"]);
	expect(size).toBeGreaterThan(4);
	const partial = await request.get(url, { headers: { Range: "bytes=0-3" } });
	expect(partial.status()).toBe(206);
	expect(partial.headers()["content-range"]).toBe(`bytes 0-3/${size}`);
	expect(await partial.body()).toHaveLength(4);
	const unsatisfiable = await request.get(url, {
		headers: { Range: `bytes=${size}-` },
	});
	expect(unsatisfiable.status()).toBe(416);
	expect(unsatisfiable.headers()["content-range"]).toBe(`bytes */${size}`);
});

for (const mediaType of ["audio", "video"] as const) {
	test(`${mediaType} controls appear before the media response is downloaded`, async ({
		page,
		browserHealth,
	}) => {
		const contentPath = mediaContentPath(E2E_SOURCE_ID, E2E_PRIMARY_MEDIA_ID);
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let requested = false;
		browserHealth.allowRequestFailure(contentPath, "net::ERR_ABORTED");
		await routeApi(page, "media/getDetails", async (route) => {
			const response = await route.fetch();
			const payload = await response.json();
			await route.fulfill({
				response,
				json: {
					...payload,
					mediaType,
					fileName:
						mediaType === "audio" ? "e2e-stream.wav" : "e2e-stream.webm",
				},
			});
		});
		await page.route(`**${contentPath}`, async (route) => {
			requested = true;
			await gate;
			await route.fulfill({
				status: 200,
				...(mediaType === "audio"
					? { contentType: "audio/wav", body: silentWav() }
					: {
							contentType: "video/webm",
							path: "src/tests/e2e/ui-gallery/video-player.webm",
						}),
			});
		});
		try {
			await page.goto("/search");
			await waitForAppHydration(page);
			const search = page.getByRole("combobox", {
				name: "メディアを検索",
				exact: true,
			});
			await search.fill(E2E_PRIMARY_FILE_NAME);
			await search.press("Enter");
			await page
				.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`)
				.press("Enter");
			await expect(page).toHaveURL(mediaPath());
			const media = page.locator(mediaType);
			const controls =
				mediaType === "audio"
					? media
					: page.getByRole("button", {
							name: "動画のループ再生を切り替える",
							exact: true,
						});
			await expect(media).toBeVisible();
			await expect(controls).toBeVisible();
			await expect(media).toHaveAttribute("src", contentPath);
			if (mediaType === "audio") {
				await expect(media).toHaveAttribute("controls", "");
				// The browser may defer metadata preload until loading is requested.
				if (!requested) {
					await media.evaluate((element: HTMLAudioElement) => element.load());
				}
			}
			await expect.poll(() => requested).toBe(true);
			await expect(controls).toBeVisible();
			release();
			await expect
				.poll(() =>
					media.evaluate((element) =>
						element instanceof HTMLMediaElement ? element.readyState : 0,
					),
				)
				.toBeGreaterThan(0);
		} finally {
			release();
			await page.unrouteAll({ behavior: "wait" });
		}
	});
}

function silentWav(): Buffer {
	const samples = 8_000;
	const body = Buffer.alloc(44 + samples * 2);
	body.write("RIFF", 0);
	body.writeUInt32LE(body.length - 8, 4);
	body.write("WAVEfmt ", 8);
	body.writeUInt32LE(16, 16);
	body.writeUInt16LE(1, 20);
	body.writeUInt16LE(1, 22);
	body.writeUInt32LE(samples, 24);
	body.writeUInt32LE(samples * 2, 28);
	body.writeUInt16LE(2, 32);
	body.writeUInt16LE(16, 34);
	body.write("data", 36);
	body.writeUInt32LE(samples * 2, 40);
	return body;
}
