import type { Media } from "@solid-imager/core/media";
import { createRoot, createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaCollectionActions } from "./use-media-collection-actions";

vi.mock("solid-js", async () =>
	vi.importActual<typeof import("solid-js")>("solid-js/dist/solid.js"),
);

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
		const notify = { success: vi.fn(), error: vi.fn() };
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
		expect(actions.selectedMediaItems()).toEqual([
			{ mediaId: "one", mediaSourceId: "source-a" },
			{ mediaId: "two", mediaSourceId: "source-b" },
			{ mediaId: "three", mediaSourceId: "source-a" },
		]);
		setItems([media("three"), media("one")]);
		expect([...actions.selection.selectedIds()]).toEqual(["one", "three"]);
		expect(actions.selectedMediaItems().map((item) => item.mediaId)).toEqual([
			"three",
			"one",
		]);
		actions.clearSelection();
		expect(actions.isBulkSelectMode()).toBe(false);
		expect(actions.selectedMediaItems()).toEqual([]);
	});

	it("retains selection after partial bulk success and clears it after full success", () => {
		const { actions, refresh } = setup();
		actions.selectAll();
		actions.onBulkSuccess(true);
		expect(actions.selection.selectedIds().size).toBe(3);
		expect(actions.isBulkSelectMode()).toBe(true);
		actions.onBulkSuccess(false);
		expect(actions.selection.selectedIds().size).toBe(0);
		expect(actions.isBulkSelectMode()).toBe(false);
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it("does not delete cancelled or unknown targets", async () => {
		const { actions, operations } = setup();
		actions.openDelete("missing");
		expect(actions.isDeleteDialogOpen()).toBe(false);
		actions.openDelete("one");
		actions.changeDeleteOpen(false);
		await actions.confirmDelete();
		expect(operations.deleteMedia).not.toHaveBeenCalled();
	});

	it("freezes a pending delete target and rejects duplicate submissions", async () => {
		const { actions, operations, refresh, notify } = setup();
		const pending = Promise.withResolvers<void>();
		operations.deleteMedia.mockReturnValueOnce(pending.promise);
		actions.selectAll();
		actions.openDelete("two");
		const deleting = actions.confirmDelete();
		actions.changeDeleteOpen(false);
		actions.openDelete("three");
		await actions.confirmDelete();
		expect(operations.deleteMedia).toHaveBeenCalledExactlyOnceWith(
			"source-b",
			"two",
		);
		expect(actions.deleteTarget()?.id).toBe("two");
		expect(refresh).not.toHaveBeenCalled();
		pending.resolve();
		await deleting;
		expect([...actions.selection.selectedIds()]).toEqual(["one", "three"]);
		expect(actions.deleteTarget()).toBeNull();
		expect(actions.isDeleteSubmitting()).toBe(false);
		expect(notify.success).toHaveBeenCalledWith("Media deleted");
		expect(refresh).toHaveBeenCalledOnce();
	});

	it("keeps failed deletions selected and allows a later retry", async () => {
		const { actions, operations, refresh, notify } = setup();
		operations.deleteMedia.mockRejectedValueOnce(new Error("offline"));
		actions.selectMedia("one", "replace");
		actions.openDelete("one");
		await actions.confirmDelete();
		expect(actions.selection.isSelected("one")).toBe(true);
		expect(notify.error).toHaveBeenCalledWith(
			"Failed to delete media: offline",
		);
		expect(refresh).not.toHaveBeenCalled();
		actions.openDelete("one");
		await actions.confirmDelete();
		expect(actions.isBulkSelectMode()).toBe(false);
		expect(actions.selection.selectedIds().size).toBe(0);
	});

	it.each(["copy", "move"] as const)(
		"submits %s through the supplied adapter and refreshes results",
		async (mode) => {
			const { actions, operations, refresh } = setup();
			actions.openCopyMove("two", mode);
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

	it("does not let a closed pending move retarget or submit twice", async () => {
		const { actions, operations, refresh, notify } = setup();
		const pending = Promise.withResolvers<void>();
		operations.moveMedia.mockReturnValueOnce(pending.promise);
		actions.openCopyMove("one", "move");
		const moving = actions.confirmCopyMove("destination");
		await actions.confirmCopyMove("other-destination");
		actions.changeCopyMoveOpen(false);
		actions.openCopyMove("three", "copy");
		expect(actions.isMoveCopyDialogOpen()).toBe(false);
		pending.reject(new Error("connection lost"));
		await moving;
		expect(operations.moveMedia).toHaveBeenCalledExactlyOnceWith(
			"one",
			"destination",
		);
		expect(operations.copyMedia).not.toHaveBeenCalled();
		expect(refresh).not.toHaveBeenCalled();
		expect(notify.error).toHaveBeenCalledWith(
			"Failed to move media: connection lost",
		);
		actions.openCopyMove("three", "copy");
		expect(actions.moveCopyTarget()?.id).toBe("three");
	});
});
