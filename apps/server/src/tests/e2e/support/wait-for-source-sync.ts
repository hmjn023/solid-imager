import { expect } from "@playwright/test";
import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/contract";
import { E2E_SOURCE_ID } from "./fixture";

export default async function waitForSourceSync(): Promise<void> {
	const client = createClient<AppContract>({
		url: `http://127.0.0.1:${process.env.E2E_PORT}`,
	});
	// The first RPC starts maintenance. Its initial scan emits source events
	// that can otherwise invalidate queries while the first scenario mounts.
	await expect
		.poll(
			async () => {
				const sources = await client.sources.list();
				const source = sources.find(({ id }) => id === E2E_SOURCE_ID);
				if (!source) throw new Error(`Missing E2E source ${E2E_SOURCE_ID}`);
				if (source.syncStatus === "error") {
					throw new Error(
						`Initial E2E source sync failed: ${source.lastSyncError}`,
					);
				}
				return source.lastSyncCompletedAt;
			},
			{ timeout: 30_000, message: "Waiting for initial E2E source sync" },
		)
		.toBeTruthy();
}
