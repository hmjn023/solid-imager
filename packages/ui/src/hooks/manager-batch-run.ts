import { similarityModelSchema } from "@solid-imager/core/search";
import { z } from "zod";
import {
	readUiStorageValue,
	removeUiStorageValue,
	UI_STORAGE_KEYS,
} from "../ui-storage";

const managerBatchRunSchema = z.object({
	jobId: z.uuid(),
	tab: z.enum(["tagging", "vectors", "thumbnails"]),
	vectorModel: similarityModelSchema,
	mediaSourceId: z.uuid().optional(),
	force: z.boolean(),
});

export type ManagerBatchRun = z.infer<typeof managerBatchRunSchema>;

/**
 * Reads the resumable batch from storage; malformed or outdated data is removed.
 *
 * @param storage - Session storage containing the saved batch.
 * @returns The validated batch, or null if missing or invalid.
 */
export function readManagerBatchRun(storage: Storage): ManagerBatchRun | null {
	const raw = readUiStorageValue(storage, UI_STORAGE_KEYS.managerBatchRun);
	if (!raw) return null;
	try {
		const result = managerBatchRunSchema.safeParse(JSON.parse(raw));
		if (result.success) return result.data;
	} catch {
		// Invalid optional UI state must not break Manager.
	}
	removeUiStorageValue(storage, UI_STORAGE_KEYS.managerBatchRun);
	return null;
}

/** Persists the current batch for session recovery; unavailable storage is ignored. */
export function saveManagerBatchRun(
	storage: Storage,
	run: ManagerBatchRun,
): void {
	try {
		storage.setItem(UI_STORAGE_KEYS.managerBatchRun, JSON.stringify(run));
	} catch {
		// A blocked session store must not prevent submitting jobs.
	}
}

/** Returns session storage when available, including in privacy-restricted browsers. */
export function managerSessionStorage(): Storage | undefined {
	try {
		return typeof window === "undefined" ? undefined : window.sessionStorage;
	} catch {
		return undefined;
	}
}

export function forgetManagerBatchRun(storage: Storage): void {
	removeUiStorageValue(storage, UI_STORAGE_KEYS.managerBatchRun);
}
