import type { SafeMediaSource } from "@solid-imager/core/sources";
import { t } from "@solid-imager/i18n";
import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { sourceTypeLabel } from "../display-labels";
import { ImportReviewModal } from "../import-review-modal";
import type {
	ImportReviewModalProps,
	PendingImportJob,
} from "../import-review-modal.types";
import { setImportSourcePreference } from "../import-source-preference";
import { Toaster } from "../toast";
import { renderComponent } from "./render-component";

const SOURCE_ID = "00000000-0000-4000-8000-000000000001";
const ARCHIVE_ID = "00000000-0000-4000-8000-000000000002";
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
const JOBS: PendingImportJob[] = [
	{
		id: "first-import",
		item: { fileName: "Landscape.png" },
		createdAt: "2026-01-01T00:00:00Z",
	},
	{
		id: "second-import",
		item: { fileName: "Portrait.png" },
		createdAt: "2026-01-01T00:00:00Z",
	},
];

test("retries failed inbox and destination requests inside the dialog", async ({
	onTestFinished,
}) => {
	const listPending = vi
		.fn<ImportReviewModalProps["listPending"]>()
		.mockRejectedValueOnce(new Error("Inbox failure"))
		.mockResolvedValueOnce(JOBS);
	const listSources = vi
		.fn<ImportReviewModalProps["listSources"]>()
		.mockRejectedValueOnce(new Error("Sources failure"))
		.mockResolvedValueOnce(SOURCES);
	onTestFinished(
		renderComponent(() => (
			<ImportReviewModal
				cancelPending={vi.fn()}
				isOpen
				listPending={listPending}
				listSources={listSources}
				onClose={vi.fn()}
				onImportCompleted={vi.fn()}
				processPending={vi.fn()}
			/>
		)),
	);
	const destinationError = page.getByRole("alert").filter({
		hasText: t("importReviewModal.failedToLoadSources"),
	});
	const inboxError = page.getByText(
		t("importReviewModal.failedToLoadImportInbox"),
	);
	await expect.element(destinationError).toBeVisible();
	await expect.element(inboxError).toBeVisible();

	const retry = { name: t("actions.retry"), exact: true };
	await destinationError.getByRole("button", retry).click();
	await expect.element(destinationError).not.toBeInTheDocument();
	await page.getByRole("button", retry).click();
	await expect.element(inboxError).not.toBeInTheDocument();
	await expect.element(page.getByText("Landscape.png")).toBeVisible();
	expect(listPending).toHaveBeenCalledTimes(2);
	expect(listSources).toHaveBeenCalledTimes(2);
});

test("chooses a local import destination when the remembered default is remote", async ({
	onTestFinished,
}) => {
	const remote: SafeMediaSource = {
		id: "00000000-0000-4000-8000-000000000003",
		name: "Default",
		description: null,
		type: "s3",
		connectionInfo: { region: "us-east-1", bucket: "fixture" },
	};
	setImportSourcePreference(true, remote.id);
	onTestFinished(() => setImportSourcePreference(false));
	const processPending = vi
		.fn<ImportReviewModalProps["processPending"]>()
		.mockResolvedValue({ success: true, processedCount: JOBS.length });
	onTestFinished(
		renderComponent(() => (
			<ImportReviewModal
				cancelPending={vi.fn()}
				isOpen
				listPending={async () => JOBS}
				listSources={async () => [remote, ...SOURCES]}
				onClose={vi.fn()}
				onImportCompleted={vi.fn()}
				processPending={processPending}
			/>
		)),
	);

	const dialog = page.getByRole("dialog", {
		name: t("navigation.importInbox"),
	});
	const destination = dialog.getByRole("combobox", {
		name: new RegExp(`^${t("importReviewModal.targetSource")}`),
	});
	await expect
		.element(destination)
		.toHaveTextContent(`Library · ${sourceTypeLabel("local")}`);
	await destination.click();
	await expect.element(dialog.getByRole("option")).toHaveLength(SOURCES.length);
	await expect
		.element(dialog.getByRole("option", { name: /Default/ }))
		.not.toBeInTheDocument();
	await userEvent.keyboard("{Escape}");
	await dialog
		.getByRole("button", {
			name: t("importReviewModal.importValue", {
				value0: t("importReviewModal.value", { value0: String(JOBS.length) }),
			}),
			exact: true,
		})
		.click();
	await vi.waitFor(() =>
		expect(processPending).toHaveBeenCalledExactlyOnceWith(
			JOBS.map((job) => job.id),
			SOURCE_ID,
		),
	);
});

test("keeps a long destination list inside the short dialog's scroll boundaries", async ({
	onTestFinished,
}) => {
	await page.viewport(390, 520);
	const manySources = [
		SOURCES[0],
		...Array.from({ length: 16 }, (_, index) => ({
			...SOURCES[0],
			id: `fixture-source-${index}`,
			name: `Fixture source ${index + 1}`,
		})),
		SOURCES[1],
	];
	onTestFinished(
		renderComponent(() => (
			<ImportReviewModal
				cancelPending={vi.fn()}
				isOpen
				listPending={async () => []}
				listSources={async () => manySources}
				onClose={vi.fn()}
				onImportCompleted={vi.fn()}
				processPending={vi.fn()}
			/>
		)),
	);
	const dialog = page.getByRole("dialog", {
		name: t("navigation.importInbox"),
	});
	const destination = dialog.getByRole("combobox", {
		name: new RegExp(`^${t("importReviewModal.targetSource")}`),
	});
	const lastLabel = `Archive · ${sourceTypeLabel("local")}`;
	await destination.click();
	const list = dialog.getByRole("listbox");
	await expect.element(list).toBeVisible();
	await expect
		.poll(() => {
			const popup = list.element().parentElement?.getBoundingClientRect();
			if (!popup) throw new Error("The destination popup did not mount");
			const bounds = dialog.element().getBoundingClientRect();
			return Math.max(bounds.top - popup.top, popup.bottom - bounds.bottom);
		})
		.toBeLessThanOrEqual(1);
	await dialog.getByRole("option", { name: lastLabel, exact: true }).click();
	await expect.element(destination).toHaveTextContent(lastLabel);
});

test("keeps the chosen jobs and destination after an import request fails", async ({
	onTestFinished,
}) => {
	const [open, setOpen] = createSignal(true);
	const onImportCompleted = vi.fn();
	const pending =
		Promise.withResolvers<
			Awaited<ReturnType<ImportReviewModalProps["processPending"]>>
		>();
	const processPending = vi
		.fn<ImportReviewModalProps["processPending"]>()
		.mockReturnValueOnce(pending.promise)
		.mockResolvedValueOnce({ success: true, processedCount: 1 });
	onTestFinished(
		renderComponent(() => (
			<>
				<ImportReviewModal
					cancelPending={vi.fn()}
					isOpen={open()}
					listPending={async () => JOBS}
					listSources={async () => SOURCES}
					onClose={() => setOpen(false)}
					onImportCompleted={onImportCompleted}
					processPending={processPending}
				/>
				<Toaster />
			</>
		)),
	);

	const dialog = page.getByRole("dialog", {
		name: t("navigation.importInbox"),
	});
	const destination = dialog.getByRole("combobox", {
		name: new RegExp(`^${t("importReviewModal.targetSource")}`),
	});
	const archiveLabel = `Archive · ${sourceTypeLabel("local")}`;
	await expect.element(destination).toBeEnabled();
	destination.element().focus();
	await userEvent.keyboard("{ArrowDown}");
	const archive = dialog.getByRole("option", {
		name: archiveLabel,
		exact: true,
	});
	await expect.element(archive).toBeVisible();
	await userEvent.keyboard("{End}{Enter}");
	await expect.element(destination).toHaveFocus();
	await expect.element(destination).toHaveTextContent(archiveLabel);
	await dialog.getByText("Portrait.png", { exact: true }).click();
	const selected = dialog.getByText(
		t("importReviewModal.valueOfValueValueSelected", {
			value0: "1",
			value1: "2",
		}),
		{ exact: true },
	);
	await expect.element(selected).toBeVisible();
	const submit = dialog.getByRole("button", {
		name: t("importReviewModal.importValue", {
			value0: t("importReviewModal.value", { value0: "1" }),
		}),
		exact: true,
	});
	await submit.click();
	await expect
		.element(
			dialog.getByRole("button", { name: t("importReviewModal.importing") }),
		)
		.toBeDisabled();
	await expect.element(destination).toBeDisabled();
	await userEvent.keyboard("{Escape}");
	await expect.element(dialog).toBeVisible();
	await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
	expect(processPending).toHaveBeenCalledExactlyOnceWith(
		[JOBS[0].id],
		ARCHIVE_ID,
	);

	const error = new Error("Archive is unavailable");
	pending.reject(error);
	await expect
		.element(
			page.getByText(
				t("importReviewModal.failedToProcessImportsValue", {
					value0: error.message,
				}),
				{ exact: true },
			),
		)
		.toBeVisible();
	await expect.element(selected).toBeVisible();
	await expect.element(destination).toHaveTextContent(archiveLabel);
	expect(onImportCompleted).not.toHaveBeenCalled();

	await submit.click();
	await expect.element(dialog).not.toBeInTheDocument();
	expect(processPending).toHaveBeenCalledTimes(2);
	expect(processPending).toHaveBeenNthCalledWith(2, [JOBS[0].id], ARCHIVE_ID);
	expect(onImportCompleted).toHaveBeenCalledOnce();
});
