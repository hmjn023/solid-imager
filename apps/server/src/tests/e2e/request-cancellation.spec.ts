import { expect, test, waitForAppHydration } from "./support/test";

for (const mode of ["initial", "refresh"] as const) {
	test(`releases a pending Jobs ${mode} transport when leaving the page`, async ({
		page,
	}) => {
		await page.addInitScript(() => {
			const state = globalThis as typeof globalThis & {
				__jobRead?: { caller: AbortSignal; transport: AbortSignal };
			};
			const originalFetch = globalThis.fetch;
			globalThis.fetch = Object.assign(
				(...args: Parameters<typeof originalFetch>) => {
					const [input, init] = args;
					if (
						input instanceof globalThis.Request &&
						new URL(input.url).pathname === "/api/rpc/jobs/list"
					) {
						state.__jobRead = {
							caller: input.signal,
							transport: init?.signal ?? input.signal,
						};
					}
					return originalFetch(...args);
				},
				originalFetch,
			);
		});
		let release!: () => void;
		let received!: () => void;
		const released = new Promise<void>((resolve) => {
			release = resolve;
		});
		const started = new Promise<void>((resolve) => {
			received = resolve;
		});
		let holdingRefresh = mode === "initial";
		await page.route(/\/api\/rpc\/jobs\/list(?:\?|$)/, async (route) => {
			if (!holdingRefresh) {
				await route.continue();
				return;
			}
			received();
			await released;
			// The intended cancellation may have already disposed this route.
			await route
				.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ json: { items: [], total: 0 } }),
				})
				.catch(() => {});
		});
		try {
			await page.goto("/jobs");
			await waitForAppHydration(page);
			if (mode === "refresh") {
				const refresh = page.getByRole("button", {
					name: "Refresh",
					exact: true,
				});
				await expect(refresh).toBeEnabled();
				holdingRefresh = true;
				await refresh.click();
			}
			await started;
			await page.getByRole("link", { name: "Library", exact: true }).click();
			await expect
				.poll(
					() =>
						page.evaluate(() => {
							const state = globalThis as typeof globalThis & {
								__jobRead?: { caller: AbortSignal; transport: AbortSignal };
							};
							return {
								caller: state.__jobRead?.caller.aborted,
								transport: state.__jobRead?.transport.aborted,
							};
						}),
					{ timeout: 2_000 },
				)
				.toEqual({ caller: true, transport: true });
			await expect(
				page
					.locator("#main-content")
					.getByText("すべてのメディア", { exact: true }),
			).toBeVisible();
		} finally {
			release();
		}
	});
}
