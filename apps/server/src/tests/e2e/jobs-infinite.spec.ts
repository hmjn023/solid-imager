import type { JobDto, JobListRequest } from "@solid-imager/core/jobs";
import { expect, test, waitForAppHydration } from "./support/test";

const date = new Date("2026-01-01T00:00:00Z");
const jobs: JobDto[] = Array.from({ length: 240 }, (_, i) => ({
	id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
	type:
		i < 220
			? "processMedia"
			: i < 235
				? "source_export"
				: i < 238
					? "auto_tagging"
					: "source_export",
	status:
		i < 220
			? "completed"
			: i < 230
				? "pending"
				: i < 235
					? "in_progress"
					: i < 238
						? "failed"
						: "cancelled",
	mediaSourceId: null,
	parentId: null,
	error: null,
	progress: null,
	artifact: null,
	createdAt: date,
	updatedAt: date,
	startedAt: null,
	finishedAt: null,
	cancelRequestedAt: null,
	cancelledAt: null,
	attemptCount: 0,
	targetMediaId: null,
	targetMediaModifiedAt: null,
}));

test("keeps the active job status visible on a phone", async ({ page }) => {
	await page.setViewportSize({ width: 430, height: 932 });
	await page.goto("/jobs");
	await waitForAppHydration(page);
	const status = page.getByRole("button", { name: "ジョブの状態で絞り込む" });
	await expect(status).toHaveText("すべての状態");
	await status.click();
	const updated = page.waitForRequest(
		(request) =>
			request.url().endsWith("/api/rpc/jobs/list") &&
			request.postDataJSON()?.json?.status === "cancelled",
	);
	await page
		.getByRole("option", { name: "キャンセル済み", exact: true })
		.click();
	await updated;
	await expect(status).toHaveText("キャンセル済み");
	await expect(status).toBeInViewport();
	await expect(
		page.getByRole("heading", { name: "条件に一致するジョブがありません" }),
	).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth - innerWidth,
		),
	).toBeLessThanOrEqual(1);
});

test("loads more jobs on scroll and counts all status/type matches beyond the first page", async ({
	page,
	browserHealth,
}) => {
	const requests: JobListRequest[] = [];
	let failMore = true;
	browserHealth.allowResponseFailure("/api/rpc/jobs/list");
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 503",
	);
	await page.route("**/api/rpc/jobs/types", (route) =>
		route.fulfill({
			json: { json: ["processMedia", "source_export", "auto_tagging"] },
		}),
	);
	await page.route("**/api/rpc/jobs/list", async (route) => {
		const { json: input } = route.request().postDataJSON() as {
			json: JobListRequest;
		};
		requests.push(input);
		if (failMore && input.offset > 0) {
			await route.fulfill({
				status: 503,
				contentType: "text/plain",
				body: "Service Unavailable",
			});
			return;
		}
		const filtered = jobs.filter(
			(job) =>
				(!input.type || input.type === job.type) &&
				(!input.status ||
					(input.status === "active"
						? ["pending", "in_progress"].includes(job.status)
						: job.status === input.status)),
		);
		await route.fulfill({
			json: {
				json: {
					items: filtered.slice(input.offset, input.offset + input.limit),
					total: filtered.length,
				},
			},
		});
	});
	await page.goto("/jobs");
	await waitForAppHydration(page);
	const rows = page.getByRole("table").locator("tbody tr");
	await expect(rows).toHaveCount(200);
	await expect(
		page.getByText("全240件中200件を表示", { exact: true }),
	).toBeVisible();
	await rows.last().scrollIntoViewIfNeeded();
	await expect(
		page.getByText("ジョブの追加読み込みに失敗しました。再試行してください。", {
			exact: true,
		}),
	).toBeVisible();
	await expect(rows).toHaveCount(200);
	failMore = false;
	await page.getByRole("button", { name: "再試行", exact: true }).click();
	await expect(rows).toHaveCount(240);
	await expect(
		page.getByText("全240件中240件を表示", { exact: true }),
	).toBeVisible();
	expect(requests.some((input) => input.offset === 200)).toBe(true);
	for (const [name, count] of [
		["実行中・待機中", 15],
		["失敗", 3],
		["キャンセル済み", 2],
		["完了", 220],
	] as const) {
		await page.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
		await expect(
			page.getByText(`全${count}件中${Math.min(count, 200)}件を表示`, {
				exact: true,
			}),
		).toBeVisible();
	}
	await page.getByRole("tab", { name: /^実行中・待機中/ }).click();
	const type = page.getByRole("button", { name: "ジョブの種類で絞り込む" });
	await type.click();
	await page.getByRole("option", { name: "AIタグ付け", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "条件に一致するジョブがありません" }),
	).toBeVisible();
	await page.getByRole("tab", { name: /^失敗/ }).click();
	await expect(rows).toHaveCount(3);
	await expect(
		page.getByText("全3件中3件を表示", { exact: true }),
	).toBeVisible();
	expect(requests.at(-1)).toMatchObject({
		status: "failed",
		type: "auto_tagging",
		offset: 0,
	});
	await page.reload();
	await waitForAppHydration(page);
	await expect(rows).toHaveCount(200);
});

test("returns to the scrolled job and restores focus on a phone", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 640 });
	await page.route("**/api/rpc/jobs/list", (route) =>
		route.fulfill({ json: { json: { items: jobs.slice(0, 60), total: 60 } } }),
	);
	await page.route("**/api/rpc/jobs/get", (route) =>
		route.fulfill({ json: { json: jobs[30] } }),
	);
	await page.goto("/jobs");
	await waitForAppHydration(page);
	const row = page.getByRole("table").locator("tbody tr").nth(30);
	const selected = row.locator("button[aria-pressed]");
	await selected.scrollIntoViewIfNeeded();
	const scrollArea = page.locator("[data-management-scroll]").first();
	const offset = await scrollArea.evaluate((element) => element.scrollTop);
	expect(offset).toBeGreaterThan(100);
	await selected.click();
	const detail = page.getByRole("complementary", { name: "ジョブの詳細" });
	await expect(detail).toBeVisible();
	await expect(scrollArea).toBeHidden();
	await detail.getByRole("button", { name: "一覧へ戻る" }).click();
	await expect(selected).toBeFocused();
	expect(await scrollArea.evaluate((element) => element.scrollTop)).toBe(
		offset,
	);
});
