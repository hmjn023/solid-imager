import { expect, test } from "./support/test";
import type { Page } from "@playwright/test";
import {
	viewerRequestSchema,
	pixivArtworkSchema,
} from "@solid-imager/core/external-viewer";
import { pendingImportJobSchema } from "@solid-imager/core/media";
import { z } from "zod";

async function navigateTo(page: Page, name: string) {
	const menu = page.getByRole("button", {
		name: "メニューを開く",
		exact: true,
	});
	if ((page.viewportSize()?.width ?? 1280) < 768) await menu.click();
	await page
		.getByRole("link", { name, exact: true })
		.filter({ visible: true })
		.click();
}
const base = "https://i.pximg.net/img-original/img/2026/01/01/00/00/00/123_p";
const artwork = pixivArtworkSchema.parse({
	id: 123,
	title: "海の風景",
	author: "作者名",
	userId: "23",
	thumbnail: base + "0.png",
	createdAt: "2026-01-01T00:00:00Z",
	isAnimation: false,
	tags: ["風景"],
	pageCount: 2,
	pages: [0, 1].map((i) => ({
		preview: base + i + ".png",
		original: base + i + ".png",
		width: 640,
		height: 400,
	})),
});
test("switches the same canonical tag between viewers, chooses a pixiv name and imports the selected page", async ({
	page,
}, info) => {
	const path = (s: string) => (info.project.name === "tauri" ? "/#" + s : s);
	await page.route("**/api/pixiv-image?*", (route) =>
		route.fulfill({
			contentType: "image/png",
			body: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cF1kAAAAASUVORK5CYII=",
				"base64",
			),
		}),
	);
	const requests: z.infer<typeof viewerRequestSchema>[] = [];
	await page.route("**/api/rpc/viewer/**", async (route) => {
		const procedure = new URL(route.request().url()).pathname.split("/").at(-1);
		let result: unknown;
		if (procedure === "pixivArtwork") result = artwork;
		else if (procedure === "suggestTags")
			result = [{ name: "landscape", category: 0, postCount: 20 }];
		else {
			const input = viewerRequestSchema.parse(
				route.request().postDataJSON().json,
			);
			requests.push(input);
			const word = input.choices?.landscape ?? "風景";
			result =
				input.provider === "danbooru"
					? { provider: "danbooru", posts: [], hasNextPage: false }
					: {
							provider: "pixiv",
							posts: [artwork],
							hasNextPage: false,
							word,
							mappings: [
								{
									tag: "landscape",
									selected: word,
									names: ["風景", "風景画", "landscape"],
									source: "wiki",
								},
							],
						};
		}
		await route.fulfill({ json: { json: result } });
	});
	await page.goto(path("/danbooru"));
	const input = page.getByRole("combobox", { name: "Danbooru を検索" });
	await input.fill("land");
	await page.getByRole("option", { name: /landscape/ }).click();
	await page.getByRole("button", { name: "検索", exact: true }).click();
	await expect.poll(() => requests.at(-1)?.tags).toBe("landscape");
	await navigateTo(page, "pixiv");
	await expect(
		page.getByRole("combobox", { name: "pixiv を検索" }),
	).toHaveValue("landscape ");
	await expect.poll(() => requests.at(-1)?.provider).toBe("pixiv");
	expect(requests.at(-1)?.tags).toBe("landscape");
	await page.getByRole("button", { name: "landscape の pixiv タグ" }).click();
	await page.getByRole("option", { name: "風景画", exact: true }).click();
	await expect.poll(() => requests.at(-1)?.choices?.landscape).toBe("風景画");
	await page.getByRole("link", { name: "海の風景 を開く" }).click();
	await page.reload();
	const dialog = page.getByRole("dialog", { name: "pixiv #123" });
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: "次の画像", exact: true }).click();
	await expect(dialog.getByRole("img", { name: "海の風景" })).toHaveAttribute(
		"src",
		/123_p1/,
	);
	await dialog
		.getByRole("button", { name: "この画像を取り込み待ちへ" })
		.click();
	await expect(
		dialog.getByRole("button", { name: "取り込み待ちに追加済み" }),
	).toBeDisabled();
	const pending = await page.request.post("/api/rpc/imports/listPending", {
		data: { json: {} },
	});
	const jobs = z
		.array(pendingImportJobSchema)
		.parse((await pending.json()).json);
	const job = jobs.find((x) => x.item.targetUrl === base + "1.png");
	expect(job?.item.sourceUrls?.at(-1)).toBe(
		"https://www.pixiv.net/artworks/123",
	);
	if (job)
		await page.request.post("/api/rpc/imports/cancel", {
			data: { json: { jobIds: [job.id] } },
		});
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/pixiv$/);
	await navigateTo(page, "Danbooru");
	await expect(
		page.getByRole("combobox", { name: "Danbooru を検索" }),
	).toHaveValue("landscape ");
});

test("connects a pixiv account, restores it on reload and removes private results on logout", async ({
	page,
}, info) => {
	const code = "A".repeat(22),
		token = "B".repeat(43);
	let active = false;
	const fixtureSession = "123_fixture";
	await page.route("**/api/rpc/viewer/**", async (route) => {
		const rpc = route.request().url().split("/").at(-1);
		const bearer = route.request().headers().authorization;
		let result: unknown;
		if (rpc === "issuePixivCode") {
			expect(route.request().postDataJSON().json.sessionId).toBe(
				fixtureSession,
			);
			result = { code };
		} else if (rpc === "loginPixiv") {
			expect(route.request().postDataJSON().json.code).toBe(code);
			expect(bearer).toBeUndefined();
			active = true;
			result = { token, userId: "123", expiresAt: Date.now() + 60_000 };
		} else if (rpc === "logoutPixiv" || rpc === "checkPixivSession") {
			expect(bearer).toBe("Bearer " + token);
			if (rpc === "logoutPixiv") active = false;
			result = rpc === "logoutPixiv" ? null : { userId: "123" };
		} else {
			const authenticated = active && bearer === "Bearer " + token;
			result = {
				provider: "pixiv",
				posts: [
					{
						id: 123,
						title: authenticated ? "会員作品" : "公開作品",
						author: "作者",
						thumbnail: null,
						pageCount: 1,
					},
				],
				hasNextPage: false,
				word: "",
				mappings: [],
			};
		}
		await route.fulfill({ json: { json: result } });
	});
	await page.goto(info.project.name === "tauri" ? "/#/pixiv" : "/pixiv");
	await expect(
		page.getByRole("link", { name: "公開作品 を開く" }),
	).toBeVisible();
	await page.getByRole("button", { name: "pixiv にログイン" }).click();
	const dialog = page.getByRole("dialog", { name: "pixiv アカウント" });
	await expect(
		dialog.getByRole("link", { name: "公式 pixiv でログイン ↗" }),
	).toHaveAttribute("href", "https://accounts.pixiv.net/login");
	await dialog.getByLabel("接続コード").fill("bad");
	await dialog.getByRole("button", { name: "接続する" }).click();
	await expect(dialog.getByRole("alert")).toContainText("接続コード");
	await dialog.getByLabel("接続コード").fill(code);
	await dialog.getByRole("button", { name: "接続する" }).click();
	await expect(
		page.getByRole("link", { name: "会員作品 を開く" }),
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("link", { name: "会員作品 を開く" }),
	).toBeVisible();
	await page.getByRole("button", { name: "pixiv ID 123" }).click();
	await dialog
		.getByRole("button", { name: "この Viewer からログアウト" })
		.click();
	await expect(
		page.getByRole("link", { name: "公開作品 を開く" }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "会員作品 を開く" })).toHaveCount(
		0,
	);
	await page.reload();
	await page.getByRole("button", { name: "pixiv にログイン" }).click();
	await dialog.getByRole("button", { name: "拡張機能を使わずに接続" }).click();
	await dialog.getByLabel("PHPSESSID").fill(fixtureSession);
	await dialog.getByRole("button", { name: "接続する" }).click();
	await expect(
		page.getByRole("link", { name: "会員作品 を開く" }),
	).toBeVisible();
	expect(
		await page.evaluate(() => JSON.stringify(sessionStorage)),
	).not.toContain(fixtureSession);
});
