import { appClient } from "~/infrastructure/app-client";

/**
 * Backwards-compatible alias while the UI migrates from `orpc` to `appClient`.
 */
export const orpc = appClient;
