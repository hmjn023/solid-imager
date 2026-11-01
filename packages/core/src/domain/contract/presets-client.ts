import type { RouterContractClient } from "@orpc/contract";
import type { presetsContract } from "./presets.contract";

/**
 * Client-shaped adapter for the shared presets contract.
 *
 * This type belongs beside the contract so server and desktop adapters do not
 * need to depend on the UI package for their transport boundary.
 */
export type PresetOrpcLike = {
	presets: RouterContractClient<typeof presetsContract>;
};
