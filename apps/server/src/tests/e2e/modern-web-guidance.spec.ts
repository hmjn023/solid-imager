import type { Page } from "@playwright/test";
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
			name: `Open ${E2E_PRIMARY_FILE_NAME} image viewer`,
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
	await page
		.getByRole("button", { name: "Quick actions", exact: true })
		.click();
	const palette = page.getByRole("dialog", {
		name: "Quick actions",
		exact: true,
	});
	const input = palette.getByRole("combobox", { name: "Search quick actions" });
	await input.fill("統計");
	for (const composition of [{ isComposing: true }, { keyCode: 229 }]) {
		await input.dispatchEvent("keydown", {
			key: "Enter",
			code: "Enter",
			...composition,
		});
		await expect(palette).toBeVisible();
		await expect(input).toHaveValue("統計");
		await expect(page).toHaveURL(/\/search$/);
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

test("zoomed images support keyboard and single-click panning", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const dialog = await openImageViewer(page);
	for (let step = 0; step < 4; step++) {
		await dialog.getByRole("button", { name: "Zoom in", exact: true }).click();
	}
	const stage = dialog.locator("[data-media-viewer-pan-handle]");
	const image = dialog.getByRole("img", {
		name: E2E_PRIMARY_FILE_NAME,
		exact: true,
	});
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
	await dialog
		.getByRole("button", { name: "Reset zoom to fit", exact: true })
		.click();
	for (let step = 0; step < 4; step++) {
		await dialog.getByRole("button", { name: "Zoom in", exact: true }).click();
	}
	await dialog
		.getByRole("button", { name: "Pan image left", exact: true })
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
			name: `Open ${E2E_PRIMARY_FILE_NAME} image viewer`,
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
	await dialog.getByRole("button", { name: "Zoom in", exact: true }).click();
	const image = dialog.getByRole("img", {
		name: E2E_PRIMARY_FILE_NAME,
		exact: true,
	});
	await expect(image).toHaveCSS("transition-duration", "0s");
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await expect(image).toHaveCSS("transition-duration", "0.15s");
	await page.keyboard.press("Escape");
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.getByRole("button", { name: "More actions", exact: true }).click();
	const popover = page.getByRole("dialog");
	await expect(
		popover.getByRole("button", { name: "Download original", exact: true }),
	).toBeVisible();
	const scale = await popover.evaluate((element) => {
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
	const navigation = page.locator(
		'nav[aria-label="Manager categories"]:visible',
	);
	await navigation.getByRole("button", { name: /Data transfer/ }).click();
	const target = page.getByRole("button", { name: /^Target source/ });
	await expect(target).toBeVisible();
	await expect(
		page.getByRole("button", { name: /^Export format/ }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: /^Restore format/ }),
	).toBeVisible();
	await target.click();
	await page
		.getByRole("option", { name: E2E_SOURCE_NAME, exact: true })
		.click();
	await expect(target).toHaveAccessibleName(
		new RegExp(`Target source.*${E2E_SOURCE_NAME}`),
	);
	for (const category of ["Batch tagging", "Thumbnails", "Duplicates"]) {
		await navigation
			.getByRole("button", { name: new RegExp(category) })
			.click();
		await expect(
			page.getByRole("button", { name: /^Target source/ }),
		).toBeVisible();
	}
});

test("media content supports byte ranges and HEAD in the serving runtime", async ({
	request,
}) => {
	const url = `/api${mediaPath()}`;
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
		const contentPath = `/api/sources/${E2E_SOURCE_ID}/${E2E_PRIMARY_MEDIA_ID}`;
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let requested = false;
		browserHealth.allowRequestFailure(contentPath, "net::ERR_ABORTED");
		await page.route("**/api/rpc/media/getDetails", async (route) => {
			const response = await route.fetch();
			const payload = await response.json();
			await route.fulfill({
				response,
				json: {
					...payload,
					json: {
						...payload.json,
						mediaType,
						fileName:
							mediaType === "audio" ? "e2e-stream.wav" : "e2e-stream.webm",
					},
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
			await page
				.locator(`[data-media-id="${E2E_PRIMARY_MEDIA_ID}"]`)
				.dblclick();
			await expect(page).toHaveURL(mediaPath());
			await expect.poll(() => requested).toBe(true);
			const media = page.locator(mediaType);
			await expect(media).toBeVisible();
			if (mediaType === "audio") {
				await expect(media).toHaveAttribute("controls", "");
			} else {
				await expect(
					page.getByRole("button", { name: "Toggle video loop", exact: true }),
				).toBeVisible();
			}
			await expect(media).toHaveAttribute("src", contentPath);
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
