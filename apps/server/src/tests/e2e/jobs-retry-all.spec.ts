import { expect, test, waitForAppHydration } from "./support/test";

const before = "2026-01-01T00:00:00.000000";
const cursor = (index: number) => ({
	before,
	afterId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
});

test("retries all failed operations across continuation pages without selecting individual rows", async ({
	page,
}) => {
	const requests: Array<{ cursor?: ReturnType<typeof cursor> }> = [];
	let individualRetries = 0;
	page.on("request", (request) => {
		if (/\/api\/rpc\/jobs\/retry(?:\?|$)/.test(request.url()))
			individualRetries++;
	});
	await page.route(/\/api\/rpc\/jobs\/retryFailed(?:\?|$)/, async (route) => {
		const envelope = JSON.parse(route.request().postData() ?? "{}");
		requests.push(envelope.json ?? {});
		const index = requests.length;
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				json: {
					retried: index < 3 ? 5 : 2,
					skipped: 0,
					failed: 0,
					cursor: index < 3 ? cursor(index) : null,
				},
			}),
		});
	});
	await page.goto("/jobs");
	await waitForAppHydration(page);
	await page.getByRole("tab", { name: /^Failed / }).click();
	await page
		.getByRole("button", { name: "Retry all failed", exact: true })
		.click();
	await expect(
		page.getByRole("status").filter({ hasText: "12件の処理を再開しました" }),
	).toBeVisible();
	expect(requests).toEqual([{}, { cursor: cursor(1) }, { cursor: cursor(2) }]);
	expect(individualRetries).toBe(0);
	await expect(
		page.getByRole("button", { name: "Retry all failed", exact: true }),
	).toBeEnabled();
});

test("shows partial retry progress after a connection failure and permits another attempt", async ({
	page,
	browserHealth,
}) => {
	browserHealth.allowResponseFailure("/api/rpc/jobs/retryFailed");
	browserHealth.allowConsole(
		"Failed to load resource: the server responded with a status of 503",
	);
	let calls = 0;
	await page.route(/\/api\/rpc\/jobs\/retryFailed(?:\?|$)/, async (route) => {
		calls++;
		await route.fulfill(
			calls === 1
				? {
						status: 200,
						contentType: "application/json",
						body: JSON.stringify({
							json: { retried: 5, skipped: 0, failed: 0, cursor: cursor(1) },
						}),
					}
				: {
						status: 503,
						contentType: "text/plain",
						body: "Service Unavailable",
					},
		);
	});
	await page.goto("/jobs");
	await waitForAppHydration(page);
	await page.getByRole("tab", { name: /^Failed / }).click();
	await page
		.getByRole("button", { name: "Retry all failed", exact: true })
		.click();
	await expect(
		page
			.getByRole("status")
			.filter({ hasText: "5件を再開したところで停止しました" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Retry all failed", exact: true }),
	).toBeEnabled();
	expect(calls).toBe(2);
});
