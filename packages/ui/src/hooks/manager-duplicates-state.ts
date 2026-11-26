import { t } from "@solid-imager/i18n";
import type { DuplicateGroup } from "@solid-imager/core/media";
import { getErrorMessage } from "@solid-imager/core/utils";
import { createSignal, type Setter } from "solid-js";
import { createSynchronousState } from "../utils/synchronous-state";

type DeleteItem = {
	sourceId: string;
	sourceName: string;
	mediaId: string;
	fileName: string;
};
type ScanResult = {
	scanId: number;
	sourceId: string | undefined;
	groups: DuplicateGroup[];
	keepIds: Set<string>;
};
type Confirmation = {
	scanId: number;
	sourceId: string | undefined;
	items: DeleteItem[];
};

/** A duplicate result, its keep choices, and its confirmation all belong to one source scope and scan generation. */
export function createManagerDuplicatesState(actions: {
	findDuplicateMedia: (
		sourceId?: string,
	) => Promise<{ groups: DuplicateGroup[] }>;
	bulkDeleteMedia: (sourceId: string, ids: string[]) => Promise<unknown>;
	sourceName: (sourceId: string) => string;
	success: (message: string) => void;
	error: (message: string) => void;
}) {
	let generation = 0;
	const sourceId = createSynchronousState<string | undefined>(undefined);
	const result = createSynchronousState<ScanResult | null>(null);
	const confirmation = createSynchronousState<Confirmation | null>(null);
	const [dialogOpen, setDialogOpen] = createSignal(false);
	const [scanning, setScanning] = createSignal(false);
	const deleting = createSynchronousState(false);
	const [status, setStatus] = createSignal<string | null>(null);

	function invalidate() {
		generation++;
		result.set(null);
		confirmation.set(null);
		setDialogOpen(false);
		setScanning(false);
		setStatus(null);
	}
	function changeSource(): undefined;
	function changeSource<U extends string | undefined>(
		value: U | ((previous: string | undefined) => U),
	): U;
	function changeSource(
		value?: string | ((previous: string | undefined) => string | undefined),
	) {
		const previous = sourceId.current();
		const next = typeof value === "function" ? value(previous) : value;
		if (next !== previous) {
			sourceId.set(next);
			invalidate();
		}
		return next;
	}
	const changeDialogOpen: Setter<boolean> = (value) => {
		const open = setDialogOpen(value);
		if (!open) confirmation.set(null);
		return open;
	};
	function changeKeep(keepIds: Set<string>) {
		const current = result.current();
		if (!current || deleting.current()) return;
		result.set({ ...current, keepIds });
		confirmation.set(null);
		setDialogOpen(false);
	}
	function chooseBy(
		compare: (
			a: DuplicateGroup["media"][number],
			b: DuplicateGroup["media"][number],
		) => number,
	) {
		const keep = new Set<string>();
		for (const group of result.current()?.groups ?? []) {
			const first = [...group.media].sort(compare)[0];
			if (first) keep.add(first.id);
		}
		changeKeep(keep);
	}
	async function scan() {
		if (deleting.current()) return;
		invalidate();
		const scanId = generation;
		const scope = sourceId.current();
		setScanning(true);
		setStatus(t("duplicates.scanning"));
		try {
			const response = await actions.findDuplicateMedia(scope);
			if (scanId !== generation || sourceId.current() !== scope) return;
			const groups = response.groups.filter((group) => group.media.length > 1);
			const keepIds = new Set<string>();
			for (const group of groups) {
				const oldest = [...group.media].sort(
					(a, b) =>
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
				)[0];
				if (oldest) keepIds.add(oldest.id);
			}
			result.set({ scanId, sourceId: scope, groups, keepIds });
			setStatus(
				t("managerDuplicatesState.valueGroupsFoundValueDuplicates", {
					value0: String(groups.length),
					value1: String(
						groups.reduce((count, group) => count + group.media.length - 1, 0),
					),
				}),
			);
		} catch (error) {
			if (scanId !== generation) return;
			const message = t("useManagerPage.errorValue", {
				value0: String(getErrorMessage(error)),
			});
			setStatus(message);
			actions.error(message);
		} finally {
			if (scanId === generation) setScanning(false);
		}
	}
	function prepareDelete() {
		const current = result.current();
		if (
			!current ||
			current.scanId !== generation ||
			current.sourceId !== sourceId.current() ||
			deleting.current()
		)
			return;
		const items = current.groups.flatMap((group) =>
			group.media
				.filter((item) => !current.keepIds.has(item.id))
				.map((item) => ({
					sourceId: item.mediaSourceId,
					sourceName: actions.sourceName(item.mediaSourceId),
					mediaId: item.id,
					fileName: item.fileName,
				})),
		);
		if (!items.length) {
			actions.error(t("managerDuplicatesState.noneSelectedForDeletion"));
			return;
		}
		confirmation.set({
			scanId: current.scanId,
			sourceId: current.sourceId,
			items,
		});
		setDialogOpen(true);
	}
	async function confirmDelete() {
		const command = confirmation.current();
		const current = result.current();
		if (
			!command ||
			!current ||
			deleting.current() ||
			command.scanId !== generation ||
			current.scanId !== command.scanId ||
			command.sourceId !== sourceId.current()
		)
			return;
		deleting.set(true);
		// Consume once before the first await; double-clicks cannot submit it again.
		confirmation.set(null);
		setDialogOpen(false);
		const bySource = new Map<string, string[]>();
		for (const item of command.items) {
			const ids = bySource.get(item.sourceId) ?? [];
			ids.push(item.mediaId);
			bySource.set(item.sourceId, ids);
		}
		const deletedIds = new Set<string>();
		let failed = 0;
		try {
			for (const [id, ids] of bySource) {
				try {
					await actions.bulkDeleteMedia(id, ids);
					for (const mediaId of ids) deletedIds.add(mediaId);
				} catch {
					failed += ids.length;
				}
			}
			if (command.scanId === generation) {
				if (!failed) {
					result.set(null);
					setStatus(null);
				} else
					result.set({
						...current,
						groups: current.groups
							.map((group) => ({
								...group,
								media: group.media.filter((item) => !deletedIds.has(item.id)),
							}))
							.filter((group) => group.media.length > 1),
					});
			}
			if (failed)
				actions.error(
					t("managerDuplicatesState.partialDeleteResult", {
						deleted: String(deletedIds.size),
						failed: String(failed),
					}),
				);
			else
				actions.success(
					t("managerDuplicatesState.deletedCount", {
						count: String(deletedIds.size),
					}),
				);
		} finally {
			deleting.set(false);
		}
	}
	return {
		sourceId: sourceId.read,
		setSourceId: changeSource,
		groups: () => result.read()?.groups ?? [],
		keepIds: () => result.read()?.keepIds ?? new Set<string>(),
		status,
		scanning,
		deleting: deleting.read,
		dialogOpen,
		setDialogOpen: changeDialogOpen,
		itemsToDelete: () => confirmation.read()?.items ?? [],
		scan,
		prepareDelete,
		confirmDelete,
		setKeepForGroup: (groupId: string, mediaId: string) => {
			const current = result.current();
			const group = current?.groups.find(
				(candidate) => candidate.id === groupId,
			);
			if (!current || !group?.media.some((item) => item.id === mediaId)) return;
			const keep = new Set(current.keepIds);
			for (const item of group.media) keep.delete(item.id);
			keep.add(mediaId);
			changeKeep(keep);
		},
		keepAllForGroup: (groupId: string) => {
			const current = result.current();
			const group = current?.groups.find(
				(candidate) => candidate.id === groupId,
			);
			if (!current || !group || group.media.length === 0) return;
			const keep = new Set(current.keepIds);
			for (const item of group.media) keep.add(item.id);
			changeKeep(keep);
		},
		isGroupSkipped: (groupId: string) => {
			const current = result.read();
			const group = current?.groups.find(
				(candidate) => candidate.id === groupId,
			);
			if (!current || !group || group.media.length === 0) return false;
			return group.media.every((item) => current.keepIds.has(item.id));
		},
		selectKeepOldest: () =>
			chooseBy(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
			),
		selectKeepLargest: () =>
			chooseBy((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0)),
		deleteCount: () => {
			const current = result.read();
			return (
				current?.groups.reduce(
					(count, group) =>
						count +
						group.media.filter((item) => !current.keepIds.has(item.id)).length,
					0,
				) ?? 0
			);
		},
	};
}
