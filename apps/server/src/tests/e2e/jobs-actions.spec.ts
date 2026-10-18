import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import type { appContract } from "@solid-imager/core/domain/contract";
import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
import { E2E_PROCESSING_JOB_ID } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

const ids = [
	"11111111-0000-4000-8000-000000000001",
	"22222222-0000-4000-8000-000000000002",
	"33333333-0000-4000-8000-000000000003",
];

test("bulk cancellation changes eligible rows and retains a failed selection for retry", async ({
	page,
	baseURL,
	browserHealth,
}) => {
	browserHealth.allowResponseFailure("/api/rpc/jobs/cancel");
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 503",
	);
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: baseURL + "/api/rpc" }),
	);
	const fixture = await client.jobs.get({ id: E2E_PROCESSING_JOB_ID });
	let jobs: JobDto[] = ids.map((id, index) => ({
		...fixture,
		id,
		type: "bulk_tagging_parent",
		status: index < 2 ? "pending" : "completed",
		canCancel: index < 2,
		canDelete: index === 2,
		canRetry: false,
	}));
	jobs.push({
		...jobs[0],
		id: "44444444-0000-4000-8000-000000000004",
		parentId: ids[0],
		type: "auto_tagging",
	});
	const requests: string[] = [];
	let fail = true;
	await page.route(/\/api\/rpc\/jobs\/list(?:\?|$)/, (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ json: { items: jobs, total: jobs.length } }),
		}),
	);
	await page.route(/\/api\/rpc\/jobs\/cancel(?:\?|$)/, async (route) => {
		const {
			json: { id },
		} = JSON.parse(route.request().postData() ?? "{}");
		requests.push(id);
		if (id === ids[1] && fail) {
			fail = false;
			await route.fulfill({ status: 503, body: "Service Unavailable" });
			return;
		}
		jobs = jobs.map((job) =>
			job.id === id || job.parentId === id
				? { ...job, status: "cancelled", canCancel: false, canDelete: true }
				: job,
		);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ json: jobs.find((job) => job.id === id) }),
		});
	});
	await page.goto("/jobs");
	await waitForAppHydration(page);
	await page.getByText("Select all jobs", { exact: true }).click();
	await page.getByRole("button", { name: /^Bulk job action/ }).click();
	await page.getByRole("option", { name: "Cancel jobs", exact: true }).click();
	await expect(page.getByText(/3 eligible for this action/)).toBeVisible();
	await page.getByRole("button", { name: "Apply", exact: true }).click();
	await expect.poll(() => requests).toEqual(ids.slice(0, 2));
	await expect(page.getByText(/1 of 4 jobs selected/)).toBeVisible();
	await page.getByRole("button", { name: "Apply", exact: true }).click();
	await expect.poll(() => requests).toEqual([ids[0], ids[1], ids[1]]);
	await expect(page.getByText(/0 of 4 jobs selected/)).toBeVisible();
	await page.reload();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("table").getByText("Cancelled", { exact: true }),
	).toHaveCount(3);
});

test("confirms individual and grouped history deletion and stays deleted after F5", async ({
	page,
	baseURL,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: baseURL + "/api/rpc" }),
	);
	const fixture = await client.jobs.get({ id: E2E_PROCESSING_JOB_ID });
	let jobs: JobDto[] = [
		{
			...fixture,
			id: ids[0],
			type: "bulk_tagging_parent",
			status: "completed",
			canCancel: false,
			canRetry: false,
			canDelete: true,
		},
		{
			...fixture,
			id: ids[1],
			parentId: ids[0],
			type: "auto_tagging",
			status: "completed",
			canCancel: false,
			canRetry: false,
			canDelete: true,
		},
		{
			...fixture,
			id: ids[2],
			type: "downloadImage",
			status: "pending",
			canCancel: true,
			canRetry: false,
			canDelete: false,
		},
	];
	const removed: string[] = [];
	await page.route(/\/api\/rpc\/jobs\/list(?:\?|$)/, (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ json: { items: jobs, total: jobs.length } }),
		}),
	);
	await page.route(/\/api\/rpc\/jobs\/delete(?:\?|$)/, async (route) => {
		const {
			json: { id },
		} = JSON.parse(route.request().postData() ?? "{}");
		removed.push(id);
		jobs = jobs.filter((job) => job.id !== id && job.parentId !== id);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ json: { success: true } }),
		});
	});
	await page.goto("/jobs");
	await waitForAppHydration(page);
	await page.getByRole("button", { name: /job 11111111$/ }).click();
	await page
		.getByRole("button", { name: "Delete history", exact: true })
		.filter({ visible: true })
		.click();
	const dialog = page.getByRole("alertdialog");
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText(/parent and all children/)).toBeVisible();
	expect(removed).toEqual([]);
	await dialog.getByRole("button", { name: "Keep history" }).click();
	await page.getByText("Select all jobs", { exact: true }).click();
	await page.getByRole("button", { name: /^Bulk job action/ }).click();
	await page
		.getByRole("option", { name: "Delete history", exact: true })
		.click();
	await expect(page.getByText(/2 eligible for this action/)).toBeVisible();
	await page.getByRole("button", { name: "Apply", exact: true }).click();
	await dialog
		.getByRole("button", { name: "Delete history", exact: true })
		.click();
	await expect(dialog).toBeHidden();
	expect(removed).toEqual([ids[0]]);
	await expect(page.getByRole("button", { name: /job 11111111$/ })).toHaveCount(
		0,
	);
	await expect(
		page.getByRole("button", { name: /job 33333333$/ }),
	).toBeVisible();
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await page.getByRole("link", { name: /^Jobs/ }).click();
	await expect(page.getByRole("button", { name: /job 11111111$/ })).toHaveCount(
		0,
	);
	await page.reload();
	await waitForAppHydration(page);
	await expect(
		page.getByRole("button", { name: /job 33333333$/ }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: /job 11111111$/ })).toHaveCount(
		0,
	);
});
