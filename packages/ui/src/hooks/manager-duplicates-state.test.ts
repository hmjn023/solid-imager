import type { DuplicateGroup } from "@solid-imager/core/media";
import { describe, expect, it, vi } from "vitest";
import { createManagerDuplicatesState } from "./manager-duplicates-state";

function deferred<T>() {
	let resolve: (value: T) => void = () => {};
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
function groups(sourceId = "source-a"): DuplicateGroup[] {
	return [
		{
			id: "group",
			reason: "sourceUrl",
			media: [1, 2].map((index) => ({
				id: `${sourceId}-${index}`,
				mediaSourceId: sourceId,
				fileName: `image-${index}.png`,
				filePath: `image-${index}.png`,
				fileSize: index,
				width: 1,
				height: 1,
				mediaType: "image",
				createdAt: new Date(index),
				modifiedAt: new Date(index),
				sourceUrls: [],
			})),
		},
	];
}
function setup(find = vi.fn(async () => ({ groups: groups() }))) {
	const bulkDeleteMedia = vi.fn(async () => undefined);
	const state = createManagerDuplicatesState({
		findDuplicateMedia: find,
		bulkDeleteMedia,
		sourceName: (id) => `Name of ${id}`,
		success: vi.fn(),
		error: vi.fn(),
	});
	return { state, bulkDeleteMedia };
}

describe("Manager duplicate scan and confirmation", () => {
	it("ignores a scan after scope change, including switching back to the same source", async () => {
		const pending = deferred<{ groups: DuplicateGroup[] }>();
		const { state, bulkDeleteMedia } = setup(vi.fn(() => pending.promise));
		state.setSourceId("source-a");
		const scan = state.scan();
		state.setSourceId("source-b");
		state.setSourceId("source-a");
		pending.resolve({ groups: groups() });
		await scan;
		expect(state.groups()).toEqual([]);
		state.prepareDelete();
		await state.confirmDelete();
		expect(bulkDeleteMedia).not.toHaveBeenCalled();
	});
	it("keeps the newest scan when two responses arrive out of order", async () => {
		const first = deferred<{ groups: DuplicateGroup[] }>();
		const second = deferred<{ groups: DuplicateGroup[] }>();
		const { state } = setup(
			vi
				.fn()
				.mockReturnValueOnce(first.promise)
				.mockReturnValueOnce(second.promise),
		);
		const a = state.scan();
		const b = state.scan();
		second.resolve({ groups: groups("new") });
		await b;
		first.resolve({ groups: groups("old") });
		await a;
		expect(state.groups()[0].media[0].mediaSourceId).toBe("new");
	});
	it("invalidates an open confirmation when the scope changes", async () => {
		const { state, bulkDeleteMedia } = setup();
		state.setSourceId("source-a");
		await state.scan();
		state.prepareDelete();
		expect(state.dialogOpen()).toBe(true);
		state.setSourceId("source-b");
		expect(state.dialogOpen()).toBe(false);
		expect(state.itemsToDelete()).toEqual([]);
		await state.confirmDelete();
		expect(bulkDeleteMedia).not.toHaveBeenCalled();
	});
	it("binds source labels and actual deletion IDs to the same confirmation and consumes it once", async () => {
		const { state, bulkDeleteMedia } = setup();
		await state.scan();
		state.prepareDelete();
		expect(state.itemsToDelete()).toEqual([
			{
				sourceId: "source-a",
				sourceName: "Name of source-a",
				mediaId: "source-a-2",
				fileName: "image-2.png",
			},
		]);
		await Promise.all([state.confirmDelete(), state.confirmDelete()]);
		expect(bulkDeleteMedia).toHaveBeenCalledExactlyOnceWith("source-a", [
			"source-a-2",
		]);
	});
	it("requires reconfirmation after keep choices change or the dialog is dismissed", async () => {
		const { state, bulkDeleteMedia } = setup();
		await state.scan();
		state.prepareDelete();
		state.setKeepForGroup("group", "source-a-2");
		await state.confirmDelete();
		expect(bulkDeleteMedia).not.toHaveBeenCalled();
		state.prepareDelete();
		expect(state.itemsToDelete()[0].mediaId).toBe("source-a-1");
		state.setDialogOpen(false);
		await state.confirmDelete();
		expect(bulkDeleteMedia).not.toHaveBeenCalled();
	});
	it("does not clear a new scope when deletion of the old snapshot finishes", async () => {
		const { state, bulkDeleteMedia } = setup();
		const deletion = deferred<undefined>();
		bulkDeleteMedia.mockReturnValue(deletion.promise);
		await state.scan();
		state.prepareDelete();
		const pending = state.confirmDelete();
		state.setSourceId("new");
		deletion.resolve(undefined);
		await pending;
		expect(state.sourceId()).toBe("new");
		expect(state.status()).toBeNull();
	});
});
