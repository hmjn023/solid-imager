import type { BulkMediaOperationResult } from "@solid-imager/core/media";
import type { SafeMediaSource } from "@solid-imager/core/sources";
import { t } from "@solid-imager/i18n";
import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import type { BulkCommandOperations } from "../bulk-action-command";
import { BulkActionDialog } from "../bulk-action-dialog";
import { renderComponent } from "./render-component";

const SOURCE_ID = "00000000-0000-4000-8000-000000000001";
const ARCHIVE_ID = "00000000-0000-4000-8000-000000000002";
const COPIED_ID = "00000000-0000-4000-8000-000000000011";
const FAILED_ID = "00000000-0000-4000-8000-000000000012";
const SKIPPED_ID = "00000000-0000-4000-8000-000000000013";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000014";

const SOURCES: SafeMediaSource[] = [
	{
		id: SOURCE_ID,
		name: "Library",
		description: null,
		type: "local",
		connectionInfo: { path: "/library" },
	},
	{
		id: ARCHIVE_ID,
		name: "Archive",
		description: null,
		type: "local",
		connectionInfo: { path: "/archive" },
	},
];

test("reports partial results and retries only eligible items at the original destination", async ({
	onTestFinished,
}) => {
	const selection = [COPIED_ID, FAILED_ID, SKIPPED_ID, UNKNOWN_ID];
	const [mediaIds, setMediaIds] = createSignal(selection);
	const [open, setOpen] = createSignal(true);
	const firstCopy = Promise.withResolvers<BulkMediaOperationResult>();
	const bulkCopyToSource = vi
		.fn<BulkCommandOperations["bulkCopyToSource"]>()
		.mockReturnValueOnce(firstCopy.promise)
		.mockResolvedValueOnce({
			success: true,
			items: [
				{ mediaId: FAILED_ID, status: "succeeded" },
				{ mediaId: SKIPPED_ID, status: "succeeded" },
			],
		});
	const onSuccess = vi.fn((_partial: boolean, succeededIds: string[]) => {
		setMediaIds((ids) => ids.filter((id) => !succeededIds.includes(id)));
	});
	onTestFinished(
		renderComponent(() => (
			<BulkActionDialog
				bulkCopyToSource={bulkCopyToSource}
				bulkDeleteMedia={vi.fn()}
				bulkMoveMedia={vi.fn()}
				bulkMoveToSource={vi.fn()}
				listSources={async () => SOURCES}
				mediaIds={mediaIds()}
				mediaSourceId={SOURCE_ID}
				onOpenChange={setOpen}
				onSuccess={onSuccess}
				open={open()}
			/>
		)),
	);

	const dialog = page.getByRole("dialog", {
		name: t("searchScreen.runBulkAction"),
	});
	const destination = dialog.getByRole("combobox", {
		name: new RegExp(`^${t("moveCopyMediaDialog.destinationSource")}`),
	});
	const confirm = dialog.getByRole("button", {
		name: t("bulkActionDialog.confirm"),
		exact: true,
	});
	await expect.element(confirm).toBeDisabled();
	await destination.click();
	await dialog.getByRole("option", { name: "Archive", exact: true }).click();
	await confirm.click();
	await expect
		.element(dialog.getByRole("button", { name: t("status.processing") }))
		.toBeDisabled();
	expect(bulkCopyToSource).toHaveBeenCalledExactlyOnceWith(
		SOURCE_ID,
		selection,
		ARCHIVE_ID,
	);
	firstCopy.resolve({
		success: false,
		items: [
			{ mediaId: COPIED_ID, status: "succeeded" },
			{ mediaId: FAILED_ID, status: "failed", error: "Copy failed" },
			{ mediaId: SKIPPED_ID, status: "not_processed", error: "Copy skipped" },
			{
				mediaId: UNKNOWN_ID,
				status: "failed",
				error: "Storage needs reconciliation",
				retryable: false,
			},
		],
	});

	const alert = dialog.getByRole("alert");
	const retry = dialog.getByRole("button", {
		name: t("bulkActionDialog.retryFailedOrUnprocessedItems"),
		exact: true,
	});
	await expect.element(alert).toHaveTextContent(
		t("bulkActionDialog.partialOutcomeWithUnknown", {
			value0: "1",
			value1: "2",
			value2: "1",
		}),
	);
	await expect.element(destination).toBeDisabled();
	await expect.element(destination).toHaveTextContent("Archive");
	expect(onSuccess).toHaveBeenNthCalledWith(1, true, [COPIED_ID]);

	await retry.click();
	await expect.element(alert).toHaveTextContent(
		t("bulkActionDialog.partialOutcomeWithUnknown", {
			value0: "2",
			value1: "0",
			value2: "1",
		}),
	);
	await expect.element(retry).toBeDisabled();
	expect(bulkCopyToSource).toHaveBeenCalledTimes(2);
	expect(bulkCopyToSource).toHaveBeenNthCalledWith(
		2,
		SOURCE_ID,
		[FAILED_ID, SKIPPED_ID],
		ARCHIVE_ID,
	);
	expect(onSuccess).toHaveBeenNthCalledWith(2, true, [FAILED_ID, SKIPPED_ID]);
});
