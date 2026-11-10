import type { DuplicateGroup } from "@solid-imager/core/media";
import { getErrorMessage } from "@solid-imager/core/utils";
import { batch, createSignal, type Setter } from "solid-js";

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
	const [sourceId, setSourceId] = createSignal<string | undefined>();
	const [result, setResult] = createSignal<ScanResult | null>(null);
	const [confirmation, setConfirmation] = createSignal<Confirmation | null>(
		null,
	);
	const [dialogOpen, setDialogOpen] = createSignal(false);
	const [scanning, setScanning] = createSignal(false);
	const [deleting, setDeleting] = createSignal(false);
	const [status, setStatus] = createSignal<string | null>(null);

	function invalidate() {
		generation++;
		setResult(null);
		setConfirmation(null);
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
		return batch(() => {
			const previous = sourceId();
			const next = setSourceId(value);
			if (next !== previous) invalidate();
			return next;
		});
	}
	const changeDialogOpen: Setter<boolean> = (value) => {
		const open = setDialogOpen(value);
		if (!open) setConfirmation(null);
		return open;
	};
	function changeKeep(keepIds: Set<string>) {
		const current = result();
		if (!current || deleting()) return;
		setResult({ ...current, keepIds });
		setConfirmation(null);
		setDialogOpen(false);
	}
	function chooseBy(
		compare: (
			a: DuplicateGroup["media"][number],
			b: DuplicateGroup["media"][number],
		) => number,
	) {
		const keep = new Set<string>();
		for (const group of result()?.groups ?? []) {
			const first = [...group.media].sort(compare)[0];
			if (first) keep.add(first.id);
		}
		changeKeep(keep);
	}
	async function scan() {
		if (deleting()) return;
		invalidate();
		const scanId = generation;
		const scope = sourceId();
		setScanning(true);
		setStatus("Scanning...");
		try {
			const response = await actions.findDuplicateMedia(scope);
			if (scanId !== generation || sourceId() !== scope) return;
			const groups = response.groups.filter((group) => group.media.length > 1);
			const keepIds = new Set<string>();
			for (const group of groups) {
				const oldest = [...group.media].sort(
					(a, b) =>
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
				)[0];
				if (oldest) keepIds.add(oldest.id);
			}
			setResult({ scanId, sourceId: scope, groups, keepIds });
			setStatus(
				`${groups.length} groups found (${groups.reduce((count, group) => count + group.media.length - 1, 0)} duplicates).`,
			);
		} catch (error) {
			if (scanId !== generation) return;
			const message = `Error: ${getErrorMessage(error)}`;
			setStatus(message);
			actions.error(message);
		} finally {
			if (scanId === generation) setScanning(false);
		}
	}
	function prepareDelete() {
		const current = result();
		if (
			!current ||
			current.scanId !== generation ||
			current.sourceId !== sourceId() ||
			deleting()
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
			actions.error("No duplicates selected for deletion");
			return;
		}
		setConfirmation({
			scanId: current.scanId,
			sourceId: current.sourceId,
			items,
		});
		setDialogOpen(true);
	}
	async function confirmDelete() {
		const command = confirmation();
		const current = result();
		if (
			!command ||
			!current ||
			deleting() ||
			command.scanId !== generation ||
			current.scanId !== command.scanId ||
			command.sourceId !== sourceId()
		)
			return;
		setDeleting(true);
		// Consume once before the first await; double-clicks cannot submit it again.
		setConfirmation(null);
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
					setResult(null);
					setStatus(null);
				} else
					setResult({
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
					`Deleted ${deletedIds.size}, failed ${failed}. Remaining duplicates are still shown.`,
				);
			else actions.success(`Deleted ${deletedIds.size} duplicate(s)`);
		} finally {
			setDeleting(false);
		}
	}
	return {
		sourceId,
		setSourceId: changeSource,
		groups: () => result()?.groups ?? [],
		keepIds: () => result()?.keepIds ?? new Set<string>(),
		status,
		scanning,
		deleting,
		dialogOpen,
		setDialogOpen: changeDialogOpen,
		itemsToDelete: () => confirmation()?.items ?? [],
		scan,
		prepareDelete,
		confirmDelete,
		setKeepForGroup: (groupId: string, mediaId: string) => {
			const current = result();
			const group = current?.groups.find(
				(candidate) => candidate.id === groupId,
			);
			if (!current || !group?.media.some((item) => item.id === mediaId)) return;
			const keep = new Set(current.keepIds);
			for (const item of group.media) keep.delete(item.id);
			keep.add(mediaId);
			changeKeep(keep);
		},
		selectKeepOldest: () =>
			chooseBy(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
			),
		selectKeepLargest: () =>
			chooseBy((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0)),
		deleteCount: () =>
			result()?.groups.reduce(
				(count, group) =>
					count +
					group.media.filter((item) => !result()?.keepIds.has(item.id)).length,
				0,
			) ?? 0,
	};
}
