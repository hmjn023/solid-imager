import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";

async function openMediaAi(page: Page, mediaType = "video") {
	const port = process.env.E2E_GALLERY_PORT;
	if (!port) throw new Error("E2E_GALLERY_PORT must be set by the E2E runner");
	await page.goto(`http://127.0.0.1:${port}/?media-ai=1&type=${mediaType}`);
	await expect(
		page.getByText(`Selected: ${mediaType}`, { exact: true }),
	).toBeVisible();
	return page.getByRole("region", { name: "Media actions", exact: true });
}

test("video detail offers thumbnail tagging and both vector models", async ({
	page,
}) => {
	const actions = await openMediaAi(page);
	await expect(
		page.getByText("AI analyzes this video's representative thumbnail."),
	).toBeVisible();
	await actions
		.getByRole("button", { name: "Extract tags", exact: true })
		.click();
	await expect(
		page.getByRole("dialog", { name: "AI Tagging Results", exact: true }),
	).toContainText("video's representative thumbnail");
	await expect(
		page.getByRole("dialog", { name: "AI Tagging Results", exact: true }),
	).toContainText("fixture-tag");
	await expect(
		page.getByRole("status").filter({ hasText: "Last action:" }),
	).toHaveText("Last action: tagging:video");
	await page.keyboard.press("Escape");

	await actions
		.getByRole("button", { name: "Find similar", exact: true })
		.click();
	await expect(
		page.getByRole("status").filter({ hasText: "Last action:" }),
	).toHaveText("Last action: similar:ccip:video");
	for (const [label, result] of [
		["Find similar (EmbeddingGemma 2)", "similar:embeddinggemma2"],
		["Extract EmbeddingGemma 2 vector", "embedding"],
		["Re-extract CCIP vector", "ccip"],
	] as const) {
		await actions
			.getByRole("button", { name: "More actions", exact: true })
			.click();
		await expect(
			page.getByRole("button", {
				name: "Detect & crop characters",
				exact: true,
			}),
		).toHaveCount(0);
		await page.getByRole("button", { name: label, exact: true }).click();
		await expect(
			page.getByRole("status").filter({ hasText: "Last action:" }),
		).toHaveText(`Last action: ${result}:video`);
	}
	await actions
		.getByRole("button", { name: "More actions", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Extract tags (OppaiOracle)", exact: true })
		.click();
	await expect(
		page.getByRole("dialog", {
			name: "OppaiOracle Tagging Results",
			exact: true,
		}),
	).toContainText("video's representative thumbnail");
	await expect(
		page.getByRole("status").filter({ hasText: "Last action:" }),
	).toHaveText("Last action: oppai:video");
});

test("audio excludes visual AI and status requests while images retain cropping", async ({
	page,
}) => {
	const actions = await openMediaAi(page, "audio");
	await expect(
		page.getByText("CCIP status requests: 0", { exact: true }),
	).toBeVisible();
	await expect(
		actions.getByRole("button", { name: "Extract tags", exact: true }),
	).toHaveCount(0);
	await expect(
		actions.getByRole("button", { name: "Find similar", exact: true }),
	).toHaveCount(0);
	await actions
		.getByRole("button", { name: "More actions", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Download original", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: /Extract|Re-extract|Find similar|Detect & crop/,
		}),
	).toHaveCount(0);
	await page.keyboard.press("Escape");

	await page.getByRole("button", { name: "Select image", exact: true }).click();
	await expect(
		actions.getByRole("button", { name: "Extract tags", exact: true }),
	).toBeVisible();
	await expect(
		actions.getByRole("button", { name: "Find similar", exact: true }),
	).toBeEnabled();
	await expect(
		page.getByText("CCIP status requests: 1", { exact: true }),
	).toBeVisible();
	await actions
		.getByRole("button", { name: "More actions", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Detect & crop characters", exact: true }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Select audio", exact: true }).click();
	await expect(
		actions.getByRole("button", { name: "Extract tags", exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByText("CCIP status requests: 1", { exact: true }),
	).toBeVisible();
});

test("collection similarity menus include videos and exclude audio", async ({
	page,
}) => {
	await openMediaAi(page);
	const collection = page.getByRole("region", {
		name: "Media collection",
		exact: true,
	});
	for (const [label, model] of [
		["類似度検索", "ccip"],
		["類似度検索（EmbeddingGemma 2）", "embeddinggemma2"],
	] as const) {
		await collection
			.getByRole("button", { name: "video fixture", exact: true })
			.click({ button: "right" });
		await page.getByRole("menuitem", { name: label, exact: true }).click();
		await expect(
			page.getByRole("status").filter({ hasText: "Last action:" }),
		).toHaveText(`Last action: grid:${model}:video`);
	}
	await collection
		.getByRole("button", { name: "audio fixture", exact: true })
		.click({ button: "right" });
	await expect(page.getByRole("menu")).toBeVisible();
	await expect(page.getByRole("menuitem", { name: /類似度検索/ })).toHaveCount(
		0,
	);
});
