import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { ORPCError, os } from "@orpc/server";
import { syncManifestSchema } from "@solid-imager/core/domain/media/schemas";
import { z } from "zod";
import { SyncService } from "~/application/services/sync-service";
import type { AppRouter } from "~/domain/shared/api-contract";

const getSyncSecret = () => process.env.SYNC_SECRET || "default_sync_secret";

/**
 * Sync Router Implementation
 */
export const syncRouter = {
	/**
	 * Get local sync manifest
	 */
	getManifest: os
		.input(
			z.object({
				sourceId: z.string().uuid(),
				secret: z.string(),
			}),
		)
		.output(syncManifestSchema)
		.handler(async ({ input }) => {
			if (input.secret !== getSyncSecret()) {
				throw new ORPCError("UNAUTHORIZED", { message: "Invalid sync secret" });
			}
			return await SyncService.generateManifest(input.sourceId);
		}),

	/**
	 * Receive and apply a sync package
	 */
	applySyncPackage: os
		.input(
			z.object({
				sourceId: z.string().uuid(),
				file: z.instanceof(File),
				secret: z.string(),
			}),
		)
		.handler(async ({ input }) => {
			if (input.secret !== getSyncSecret()) {
				throw new ORPCError("UNAUTHORIZED", { message: "Invalid sync secret" });
			}
			return await SyncService.processSyncPackage(
				input.sourceId,
				input.file.stream() as any,
			);
		}),

	/**
	 * Trigger a pull sync from a remote server
	 */
	pull: os
		.input(
			z.object({
				localSourceId: z.string().uuid(),
				remoteUrl: z.string().url(),
				remoteSourceId: z.string().uuid(),
				remoteSecret: z.string(),
			}),
		)
		.handler(async ({ input }) => {
			// 1. Connect to remote
			const remoteClient = createORPCClient<AppRouter>(
				new RPCLink({
					url: new URL("/api/rpc/", input.remoteUrl).toString(),
					fetch,
				}),
			);

			// 2. Get manifests
			const localManifest = await SyncService.generateManifest(
				input.localSourceId,
			);
			const remoteManifest = await remoteClient.sync.getManifest({
				sourceId: input.remoteSourceId,
				secret: input.remoteSecret,
			});

			// 3. Compare
			const diff = SyncService.compareManifests(localManifest, remoteManifest);

			const filesToPull = [
				...diff.missingLocally.map((i) => i.filePath),
				...diff.updateLocally.map((i) => i.filePath),
			];

			if (filesToPull.length === 0) {
				return { success: true, message: "Already in sync", pulledCount: 0 };
			}

			// 4. Request package from remote
			// Note: We need a way to get binary from remote.
			// Since oRPC doesn't support binary easily in handler return,
			// we use a dedicated REST endpoint for downloading the sync package.
			const downloadUrl = new URL(
				`/api/sync/package?sourceId=${input.remoteSourceId}&files=${encodeURIComponent(JSON.stringify(filesToPull))}`,
				input.remoteUrl,
			);

			const response = await fetch(downloadUrl.toString(), {
				headers: {
					"X-Sync-Secret": input.remoteSecret,
				},
			});
			if (!response.ok) {
				throw new Error(
					`Failed to download sync package: ${response.statusText}`,
				);
			}

			// 5. Apply
			const result = await SyncService.processSyncPackage(
				input.localSourceId,
				response.body as any,
			);

			return {
				success: true,
				pulledCount: filesToPull.length,
				result,
			};
		}),

	/**
	 * Trigger a push sync to a remote server
	 */
	push: os
		.input(
			z.object({
				localSourceId: z.string().uuid(),
				remoteUrl: z.string().url(),
				remoteSourceId: z.string().uuid(),
				remoteSecret: z.string(),
			}),
		)
		.handler(async ({ input }) => {
			// 1. Connect to remote
			const remoteClient = createORPCClient<AppRouter>(
				new RPCLink({
					url: new URL("/api/rpc/", input.remoteUrl).toString(),
					fetch,
				}),
			);

			// 2. Get manifests
			const localManifest = await SyncService.generateManifest(
				input.localSourceId,
			);
			const remoteManifest = await remoteClient.sync.getManifest({
				sourceId: input.remoteSourceId,
				secret: input.remoteSecret,
			});

			// 3. Compare
			const diff = SyncService.compareManifests(localManifest, remoteManifest);

			const filesToPush = [
				...diff.missingRemotely.map((i) => i.filePath),
				...diff.updateRemotely.map((i) => i.filePath),
			];

			if (filesToPush.length === 0) {
				return { success: true, message: "Already in sync", pushedCount: 0 };
			}

			// 4. Prepare package
			const packageStream = await SyncService.prepareSyncPackage(
				input.localSourceId,
				filesToPush,
			);

			// 5. Push to remote
			// Re-use applySyncPackage on remote
			const formData = new FormData();
			const blob = await new Response(packageStream).blob();
			formData.append("file", blob, "sync-package.zip");
			formData.append(
				"input",
				JSON.stringify({
					sourceId: input.remoteSourceId,
					secret: input.remoteSecret,
				}),
			);

			const remoteApplyUrl = new URL(
				"/api/rpc/sync.applySyncPackage",
				input.remoteUrl,
			);
			const response = await fetch(remoteApplyUrl.toString(), {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Failed to push sync package: ${error}`);
			}

			return {
				success: true,
				pushedCount: filesToPush.length,
				remoteResult: await response.json(),
			};
		}),
};
