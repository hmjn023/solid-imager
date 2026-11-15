import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";

async function openVideoPlayer(page: Page, playLabel = "再生") {
	const port = process.env.E2E_GALLERY_PORT;
	if (!port) throw new Error("E2E_GALLERY_PORT must be set by the E2E runner");
	await page.goto(`http://127.0.0.1:${port}/?video-player=1`);
	const player = page.locator("media-controller");
	const video = player.locator("video");
	await expect(video).toHaveJSProperty("controls", false);
	await expect
		.poll(() => video.evaluate((element: HTMLVideoElement) => element.duration))
		.toBeGreaterThan(0);
	await expect(player.locator("media-time-display")).toContainText("/ 0:04");
	await expect(player.locator("media-play-button")).toHaveAccessibleName(
		playLabel,
	);
	return {
		player,
		video,
		loop: player.getByRole("button", {
			name:
				playLabel === "play"
					? "Toggle video loop"
					: "動画のループ再生を切り替える",
		}),
	};
}

test("video control labels restore the application's English preference", async ({
	page,
}) => {
	await page.addInitScript(() => {
		if (location.protocol === "http:" || location.protocol === "https:")
			localStorage.setItem("solid-imager.locale", "en");
	});
	const { player, loop } = await openVideoPlayer(page, "play");
	await expect(player).toHaveAttribute("lang", "en");
	await expect(loop).toHaveAccessibleName("Toggle video loop");
	await expect(player.locator("media-mute-button")).toHaveAccessibleName(
		"mute",
	);
	await page.reload();
	await expect(player.locator("media-play-button")).toHaveAccessibleName(
		"play",
	);
});

test("video controls share one bar and support playback, keyboard, seek and fullscreen", async ({
	page,
}, testInfo) => {
	const { player, video, loop } = await openVideoPlayer(page);
	await expect(
		player.locator("media-control-bar").getByRole("button", {
			name: "動画のループ再生を切り替える",
		}),
	).toBeVisible();
	await expect(loop).toHaveAttribute("aria-pressed", "true");
	await loop.focus();
	await page.keyboard.press("Space");
	await expect(loop).toHaveAttribute("aria-pressed", "false");
	await expect(video).toHaveJSProperty("loop", false);
	await expect(video).toHaveJSProperty("paused", true);
	await page.keyboard.press("Enter");
	await expect(loop).toHaveAttribute("aria-pressed", "true");
	await expect(video).toHaveJSProperty("loop", true);
	await expect(video).toHaveJSProperty("paused", true);
	await page.keyboard.press("Space");
	await expect(video).toHaveJSProperty("loop", false);
	await expect(video).toHaveJSProperty("paused", true);
	// Browser context-menu actions change the media element directly.
	await video.evaluate((element: HTMLVideoElement) => {
		element.loop = true;
	});
	await expect(loop).toHaveAttribute("aria-pressed", "true");
	await video.evaluate((element: HTMLVideoElement) => {
		element.loop = false;
	});
	await expect(loop).toHaveAttribute("aria-pressed", "false");

	const play = player.locator("media-play-button");
	await play.click();
	await expect(video).toHaveJSProperty("paused", false);
	await expect
		.poll(() =>
			video.evaluate((element: HTMLVideoElement) => element.currentTime),
		)
		.toBeGreaterThan(0);
	await loop.focus();
	await page.mouse.move(1, 1);
	await expect(player).toHaveAttribute("userinactive", "");
	await expect(loop).toBeFocused();
	await expect(player.locator(".video-player-controls")).toHaveCSS(
		"opacity",
		"1",
	);
	await expect(video).toHaveJSProperty("paused", false);
	await play.click();
	await expect(video).toHaveJSProperty("paused", true);

	const mute = player.locator("media-mute-button");
	await mute.click();
	await expect(video).toHaveJSProperty("muted", true);
	await mute.click();
	await expect(video).toHaveJSProperty("muted", false);

	const timeline = player.locator("media-time-range").getByRole("slider");
	const timelineBounds = await timeline.boundingBox();
	if (!timelineBounds) throw new Error("Video timeline must be visible");
	await timeline.click({
		position: { x: timelineBounds.width / 2, y: timelineBounds.height / 2 },
	});
	await expect
		.poll(() =>
			video.evaluate((element: HTMLVideoElement) => element.currentTime),
		)
		.toBeGreaterThan(1);
	await expect
		.poll(() =>
			video.evaluate((element: HTMLVideoElement) => element.currentTime),
		)
		.toBeLessThan(3);

	if (await page.evaluate(() => document.fullscreenEnabled)) {
		await player.locator("media-fullscreen-button").click();
		await expect
			.poll(() =>
				player.evaluate((element) => document.fullscreenElement === element),
			)
			.toBe(true);
		await expect(loop).toBeVisible();
		await loop.click();
		await expect(video).toHaveJSProperty("loop", true);
		await player.locator("media-fullscreen-button").click();
		await expect
			.poll(() => page.evaluate(() => document.fullscreenElement === null))
			.toBe(true);
	}
	await testInfo.attach("video-player-desktop", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
});

test("loop repeats the video, can stop at the end, and resets for another source", async ({
	page,
}) => {
	const { player, video, loop } = await openVideoPlayer(page);
	await video.evaluate((element: HTMLVideoElement) => {
		element.currentTime = element.duration - 0.25;
	});
	await player.locator("media-play-button").click();
	await expect(video).toHaveJSProperty("paused", false);
	await expect
		.poll(() =>
			video.evaluate((element: HTMLVideoElement) => element.currentTime),
		)
		.toBeLessThan(1);
	await expect(video).toHaveJSProperty("ended", false);

	await loop.click();
	await expect(video).toHaveJSProperty("loop", false);
	await video.evaluate((element: HTMLVideoElement) => {
		element.currentTime = element.duration - 0.25;
	});
	await expect(video).toHaveJSProperty("ended", true);
	await expect(video).toHaveJSProperty("paused", true);

	await page.getByRole("button", { name: "Switch video" }).click();
	await expect(video).toHaveAttribute("src", /\?second$/);
	await expect(video).toHaveJSProperty("loop", true);
	await expect(video).toHaveJSProperty("paused", true);
	await expect(loop).toHaveAttribute("aria-pressed", "true");
});

test.describe("narrow touch video controls", () => {
	test.use({ hasTouch: true, viewport: { width: 320, height: 720 } });

	test("remain usable without horizontal overflow", async ({
		page,
	}, testInfo) => {
		const { player, video, loop } = await openVideoPlayer(page);
		const controls = [
			player.locator("media-play-button"),
			player.locator("media-mute-button"),
			loop,
			player.locator("media-fullscreen-button"),
		];
		for (const control of controls) {
			await expect(control).toBeVisible();
			const bounds = await control.boundingBox();
			if (!bounds) throw new Error("Video controls must have visible bounds");
			expect(bounds.width).toBeGreaterThanOrEqual(44);
			expect(bounds.height).toBeGreaterThanOrEqual(44);
			expect(bounds.x).toBeGreaterThanOrEqual(0);
			expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
		}
		const overflow = await page.evaluate(
			() =>
				document.documentElement.scrollWidth -
				document.documentElement.clientWidth,
		);
		expect(overflow).toBeLessThanOrEqual(1);
		await loop.tap();
		await expect(video).toHaveJSProperty("loop", false);
		await player.locator("media-play-button").tap();
		await expect(video).toHaveJSProperty("paused", false);
		await player.locator("media-play-button").tap();
		await expect(video).toHaveJSProperty("paused", true);
		await expect(player.locator("media-play-button")).toHaveAccessibleName(
			"再生",
		);
		await testInfo.attach("video-player-320", {
			body: await page.screenshot(),
			contentType: "image/png",
		});
	});
});
