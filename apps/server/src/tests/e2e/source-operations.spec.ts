import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { appContract } from "@solid-imager/core/domain/contract";
import { E2E_SOURCE_ID } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("reloads a dedicated source export and downloads its owned artifact", async ({
	page,
	baseURL,
	request,
}) => {
	const client: ContractRouterClient<typeof appContract> = createORPCClient(
		new RPCLink({ url: baseURL + "/api/rpc" }),
	);
	const queued = await client.sources.enqueueExport({
		id: E2E_SOURCE_ID,
		mode: "ndjson",
		includeImages: false,
	});
	await expect
		.poll(async () => (await client.sourceRuns.get({ id: queued.id })).status, {
			timeout: 30_000,
		})
		.toBe("completed");
	const state = await client.sourceRuns.get({ id: queued.id });
	expect(state.artifact?.contentType).toBe("application/x-ndjson");
	expect(state).not.toHaveProperty("input");
	expect(state.artifact).not.toHaveProperty("path");
	await page.goto("/jobs");
	await waitForAppHydration(page);
	const select = () =>
		page
			.getByRole("button", {
				name: new RegExp("job " + queued.id.slice(0, 8) + "$"),
			})
			.click();
	await select();
	await expect(
		page
			.getByRole("button", { name: /^Download source-/ })
			.filter({ visible: true }),
	).toBeVisible();
	await page.reload();
	await waitForAppHydration(page);
	await select();
	await expect(
		page
			.getByRole("button", { name: /^Download source-/ })
			.filter({ visible: true }),
	).toBeVisible();
	const artifact = await request.get(
		baseURL + "/api/jobs/" + queued.id + "/artifact",
	);
	expect(artifact.ok()).toBe(true);
	expect(artifact.headers()["content-type"]).toContain("application/x-ndjson");
	expect((await artifact.text()).trim().length).toBeGreaterThan(0);
});
