import { implement } from "@orpc/server";
import { appContract } from "@solid-imager/core/contract";
import { featureRouters } from "./feature-routers";
import { configRouter } from "./routers/config-router";

/**
 * Server implementation of the shared API contract.
 *
 * Keeping the contract on the implementer makes every server procedure
 * compile against the same contract consumed by Tauri, CLI, and xtracter.
 */
export const appRouter = implement(appContract).router({
	...featureRouters,
	config: configRouter,
});
