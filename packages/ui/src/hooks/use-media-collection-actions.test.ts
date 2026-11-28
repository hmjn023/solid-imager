import type { Media } from "@solid-imager/core/media";
import { t } from "@solid-imager/i18n";
import { createRoot, createSignal, flush } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaCollectionActions } from "./use-media-collection-actions";

function media(id: string, mediaSourceId = "source-a"): Media {
	return {
		id,
		mediaSourceId,
		fileName: `${id}.png`,
		filePath: `${id}.png`,
		mediaType: "image",
		width: 1,
		height: 1,
		fileSize: 1,
		description: null,
		createdAt: new Date(0),
		modifiedAt: new Date(0),
		indexedAt: new Date(0),
		status: "active",
	};
}

const disposers: Array<() => void> = [];
afterEach(() => {
	for (const dispose of disposers.splice(0)) dispose();
});

function setup() {
	return createRoot((dispose) => {
		disposers.push(dispose);
		const [items, setItems] = createSignal([
			media("one"),
			media("two", "source-b"),
			media("three"),
		]);
		const operations = {
			deleteMedia: vi.fn(async (_sourceId: string, _id: string) => {}),
			copyMedia: vi.fn(async (_id: string, _target: string) => {}),
			moveMedia: vi.fn(async (_id: string, _target: string) => {}),
		};
		const notify = { success: vi.fn() };
		const refresh = vi.fn();
		const actions = useMediaCollectionActions({
			media: items,
			operations,
			notify,
			refresh,
		});
		return { actions, operations, notify, refresh, setItems };
	});
}

describe("shared media collection workflows", () => {
	it("keeps ordered multi-source selection across refreshes and removes filtered items", () => {
		const { actions, setItems } = setup();
		actions.selectMedia("one", "replace");
		actions.selectMedia("three", "range");
		flush();
		expect(actions.selectedMediaItems()).toEqual([
			{ mediaId: "one", mediaSourceId: "source-a" },
			{ mediaId: "two", mediaSourceId: "source-b" },
			{ mediaId: "three", mediaSourceId: "source-a" },
		]);
		setItems([media("three"), media("one")]);
		flush();
		expect([...actions.selection.selectedIds()]).toEqual(["one", "three"]);
		expect(actions.selectedMediaItems().map((item) => item.mediaId)).toEqual([
			"three",
			"one",
		]);
		actions.clearSelection();
		flush();
		expect(actions.isBulkSelectMode()).toBe(false);
		expect(actions.selectedMediaItems()).toEqual([]);
	});

	it("removes confirmed successes and retains unresolved selection after partial results", () => {
		const { actions, refresh } = setup();
		actions.selectAll();
		flush();
		actions.onBulkSuccess(true, ["one"]);
		flush();
		expect([...actions.selection.selectedIds()]).toEqual(["two", "three"]);
		expect(actions.isBulkSelectMode()).toBe(true);
		actions.onBulkSuccess(false, ["two", "three"]);
		flush();
		expect(actions.selection.selectedIds().size).toBe(0);
		expect(actions.isBulkSelectMode()).toBe(false);
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it("does not delete cancelled or unknown targets", async () => {
		const { actions, operations } = setup();
		actions.openDelete("missing");
		flush();
		expect(actions.isDeleteDialogOpen()).toBe(false);
		actions.openDelete("one");
		flush();
		actions.changeDeleteOpen(false);
		flush();
		await actions.confirmDelete();
		expect(operations.deleteMedia).not.toHaveBeenCalled();
	});

	it("freezes a pending delete target and rejects duplicate submissions", async () => {
		const { actions, operations, refresh, notify } = setup();
		const pending = Promise.withResolvers<void>();
		operations.deleteMedia.mockReturnValueOnce(pending.promise);
		actions.selectAll();
		actions.openDelete("two");
		flush();
		const deleting = actions.confirmDelete();
		actions.changeDeleteOpen(false);
		actions.openDelete("three");
		const duplicate = actions.confirmDelete();
		flush();
		expect(actions.isDeleteDialogOpen()).toBe(true);
		await duplicate;
		expect(operations.deleteMedia).toHaveBeenCalledExactlyOnceWith(
			"source-b",
			"two",
		);
		expect(actions.deleteTarget()?.id).toBe("two");
		expect(refresh).not.toHaveBeenCalled();
		pending.resolve();
		await deleting;
		expect([...actions.selection.selectedIds()]).toEqual(["one", "three"]);
		expect(actions.deleteTarget()).toBeUndefined();
		expect(actions.isDeleteSubmitting()).toBe(false);
		expect(notify.success).toHaveBeenCalledWith(
			t("useSourceMediaPage.mediaDeletedSuccessfully"),
		);
		expect(refresh).toHaveBeenCalledOnce();
	});

	it("keeps failed deletions selected and allows a later retry", async () => {
		const { actions, operations, refresh } = setup();
		operations.deleteMedia.mockRejectedValueOnce(new Error("offline"));
		actions.selectMedia("one", "replace");
		actions.openDelete("one");
		flush();
		await actions.confirmDelete();
		expect(actions.selection.isSelected("one")).toBe(true);
		expect(actions.deleteError()).toBe(
			t("mediaActions.failedToDeleteMediaValue", { value0: "offline" }),
		);
		expect(refresh).not.toHaveBeenCalled();
		const duplicate = actions.confirmDelete();
		flush();
		expect(actions.isDeleteDialogOpen()).toBe(true);
		await duplicate;
		expect(actions.deleteError()).toBeUndefined();
		expect(actions.isDeleteDialogOpen()).toBe(false);
		expect(actions.isBulkSelectMode()).toBe(false);
		expect(actions.selection.selectedIds().size).toBe(0);
	});

	it.each(["copy", "move"] as const)(
		"submits %s through the supplied adapter and refreshes results",
		async (mode) => {
			const { actions, operations, refresh } = setup();
			actions.openCopyMove("two", mode);
			flush();
			await actions.confirmCopyMove("destination");
			const action =
				mode === "copy" ? operations.copyMedia : operations.moveMedia;
			const other =
				mode === "copy" ? operations.moveMedia : operations.copyMedia;
			expect(action).toHaveBeenCalledExactlyOnceWith("two", "destination");
			expect(other).not.toHaveBeenCalled();
			expect(refresh).toHaveBeenCalledOnce();
			expect(actions.isMoveCopyDialogOpen()).toBe(false);
		},
	);

	it("does not resend an unconfirmed copy to the same destination", async () => {
		const { actions, operations } = setup();
		operations.copyMedia.mockRejectedValueOnce(new Error("connection lost"));
		actions.openCopyMove("one", "copy");
		flush();
		await actions.confirmCopyMove("destination");
		expect(actions.moveCopyError()).toBe(
			t("useSourceMediaPage.copyOutcomeUnknown"),
		);
		await actions.confirmCopyMove("destination");
		actions.changeCopyMoveOpen(false);
		actions.openCopyMove("one", "copy");
		flush();
		await actions.confirmCopyMove("destination");
		expect(operations.copyMedia).toHaveBeenCalledExactlyOnceWith(
			"one",
			"destination",
		);
		await actions.confirmCopyMove("other-destination");
		expect(operations.copyMedia).toHaveBeenLastCalledWith(
			"one",
			"other-destination",
		);
	});

	it("keeps a pending move open and retries a failure without retargeting", async () => {
		const { actions, operations, refresh } = setup();
		const pending = Promise.withResolvers<void>();
		operations.moveMedia.mockReturnValueOnce(pending.promise);
		actions.openCopyMove("one", "move");
		flush();
		const moving = actions.confirmCopyMove("destination");
		await actions.confirmCopyMove("other-destination");
		actions.changeCopyMoveOpen(false);
		actions.openCopyMove("three", "copy");
		expect(actions.isMoveCopyDialogOpen()).toBe(true);
		pending.reject(new Error("connection lost"));
		await moving;
		expect(operations.moveMedia).toHaveBeenCalledExactlyOnceWith(
			"one",
			"destination",
		);
		expect(operations.copyMedia).not.toHaveBeenCalled();
		expect(refresh).not.toHaveBeenCalled();
		expect(actions.moveCopyError()).toBe(
			t("useSourceMediaPage.moveFailed", { error: "connection lost" }),
		);
		expect(actions.moveCopyTarget()?.id).toBe("one");
		await actions.confirmCopyMove("destination");
		expect(operations.moveMedia).toHaveBeenCalledTimes(2);
		expect(actions.moveCopyError()).toBeUndefined();
		expect(actions.isMoveCopyDialogOpen()).toBe(false);
	});
});
