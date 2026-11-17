import { pixivRelatedPageSchema } from "@solid-imager/core/external-viewer";
import { z } from "zod";
import { readUiStorageValue, removeUiStorageValue } from "../ui-storage";

const prefix = "solid-imager:pixiv-related-history:v1:";
const snapshotSchema = z.object({
	data: z
		.object({
			pages: z.array(pixivRelatedPageSchema).min(1),
			pageParams: z
				.array(pixivRelatedPageSchema.shape.nextIds.nullish())
				.transform((params) => params.map((param) => param ?? undefined)),
		})
		.refine((data) => data.pages.length === data.pageParams.length),
	scrollTop: z.number().nonnegative(),
	focusId: z.number().int().positive().optional(),
});

export type PixivRelatedSnapshot = z.infer<typeof snapshotSchema>;

export function readPixivRelatedSnapshot(
	key: string,
): PixivRelatedSnapshot | undefined {
	try {
		const raw = readUiStorageValue(sessionStorage, prefix + key);
		const parsed = snapshotSchema.safeParse(raw ? JSON.parse(raw) : undefined);
		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
}

export function writePixivRelatedSnapshot(
	key: string,
	snapshot: PixivRelatedSnapshot,
) {
	try {
		sessionStorage.setItem(prefix + key, JSON.stringify(snapshot));
	} catch {
		// Keep in-memory navigation usable when browser storage is unavailable.
	}
}

export function clearPixivRelatedSnapshots() {
	try {
		const keys = Array.from({ length: sessionStorage.length }, (_, index) =>
			sessionStorage.key(index),
		).filter((key): key is string => key !== null && key.startsWith(prefix));
		for (const key of keys) removeUiStorageValue(sessionStorage, key);
	} catch {
		// Browser storage is optional.
	}
}
