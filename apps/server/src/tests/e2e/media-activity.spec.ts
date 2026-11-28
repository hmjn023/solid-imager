import {
	apiPathPattern,
	apiRequest,
	apiRequestMatches,
	apiResponse,
} from "./support/api";
import {
	E2E_PRIMARY_MEDIA_ID,
	E2E_SOURCE_ID,
	mediaPath,
} from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";
import { mediaActivitySchema } from "@solid-imager/core/media";

test("a detail visit counts once and ratings can be changed and cleared", async ({
	page,
	browserHealth,
}) => {
	const location = { sourceId: E2E_SOURCE_ID, mediaId: E2E_PRIMARY_MEDIA_ID };
	const details = await apiRequest(page.request, "media/getDetails", location);
	expect(details.ok()).toBe(true);
	const original = mediaActivitySchema.parse((await details.json()).activity);
	const firstRating = original.rating === 3 ? 2 : 3;
	const nextRating = firstRating + 1;
	const visitResponses = () =>
		page.waitForResponse(
			(response) => apiResponse("media/recordView")(response) && response.ok(),
		);
	let visits = 0;
	page.on("request", (request) => {
		if (apiRequestMatches("media/recordView")(request)) visits++;
	});
	const picker = page.getByRole("radiogroup", { name: "評価", exact: true });
	const firstStar = picker.getByRole("radio", { name: `星${firstRating}つ` });
	const nextStar = picker.getByRole("radio", { name: `星${nextRating}つ` });
	const clear = page.getByRole("button", { name: "未評価", exact: true });
	try {
		const first = visitResponses();
		await page.goto(mediaPath());
		await first;
		await waitForAppHydration(page);
		const favorite = page.getByRole("button", { name: /お気に入り/ });
		await favorite.click();
		await expect(favorite).toHaveAttribute(
			"aria-pressed",
			String(!original.favorite),
		);
		await firstStar.click();
		await expect(firstStar).toBeChecked();
		await expect(firstStar).toBeEnabled();
		await favorite.press("Tab");
		await expect(firstStar).toBeFocused();
		await firstStar.press("ArrowRight");
		await expect(nextStar).toBeChecked();
		await expect(nextStar).toBeFocused();
		expect(visits).toBe(1);
		const second = visitResponses();
		await page.reload();
		const activity = mediaActivitySchema.parse(await (await second).json());
		await expect(
			page.getByText(`閲覧数: ${activity.viewCount}`, { exact: true }),
		).toBeVisible();
		await expect(favorite).toHaveAttribute(
			"aria-pressed",
			String(!original.favorite),
		);
		await expect(nextStar).toBeChecked();
		expect(activity.lastViewedAt).toBeInstanceOf(Date);
		expect(visits).toBe(2);

		await page.setViewportSize({ width: 320, height: 760 });
		const stars = picker.getByRole("radio");
		await expect(stars).toHaveCount(5);
		for (const control of [...(await stars.all()), clear]) {
			await expect(control).toBeVisible();
			const box = await control.boundingBox();
			if (!box) throw new Error("Rating control is outside the layout");
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.height).toBeGreaterThanOrEqual(44);
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(320);
		}

		const pending = Promise.withResolvers<void>();
		const updatePreferences = apiPathPattern("media/updatePreferences");
		browserHealth.allowResponseFailure(updatePreferences);
		browserHealth.allowConsole(/Failed to load resource:.*503/);
		await page.route(
			updatePreferences,
			async (route) => {
				await pending.promise;
				await route.fulfill({
					status: 503,
					json: { code: "SERVICE_UNAVAILABLE", message: "Fixture unavailable" },
				});
			},
			{ times: 1 },
		);
		try {
			await clear.click();
			await expect(clear).toBeDisabled();
			await expect(clear).toBeFocused();
			await expect(nextStar).toBeChecked();
			await page.keyboard.press("Enter");
		} finally {
			pending.resolve();
		}
		await expect(
			page.getByText("メディアの設定を保存できませんでした", { exact: true }),
		).toBeVisible();
		await expect(clear).toBeEnabled();
		await expect(nextStar).toBeChecked();

		await clear.click();
		await expect(picker.getByRole("radio", { checked: true })).toHaveCount(0);
		await expect(clear).toHaveAttribute("aria-pressed", "true");
		const cleared = await apiRequest(
			page.request,
			"media/getDetails",
			location,
		);
		expect(cleared.ok()).toBe(true);
		expect(
			mediaActivitySchema.parse((await cleared.json()).activity).rating,
		).toBe(0);
	} finally {
		const restored = await apiRequest(page.request, "media/updatePreferences", {
			...location,
			data: { rating: original.rating, favorite: original.favorite },
		});
		expect(restored.ok()).toBe(true);
	}
});
