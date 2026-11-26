import type { SafeMediaSource } from "@solid-imager/core/sources";
import { t } from "@solid-imager/i18n";
import { createSignal } from "solid-js";
import { expect, test, type TestContext, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	MoveCopyMediaDialog,
	type MoveCopyMediaDialogProps,
} from "../move-copy-media-dialog";
import { renderComponent } from "./render-component";

const CURRENT_SOURCE_ID = "00000000-0000-4000-8000-000000000001";
const ARCHIVE_SOURCE_ID = "00000000-0000-4000-8000-000000000002";
const BACKUP_SOURCE_ID = "00000000-0000-4000-8000-000000000003";
const SOURCES: SafeMediaSource[] = [
	{
		id: CURRENT_SOURCE_ID,
		name: "Current source",
		description: null,
		type: "local",
		connectionInfo: { path: "/current" },
	},
	{
		id: ARCHIVE_SOURCE_ID,
		name: "Archive",
		description: null,
		type: "local",
		connectionInfo: { path: "/archive" },
	},
	{
		id: BACKUP_SOURCE_ID,
		name: "Backup",
		description: null,
		type: "local",
		connectionInfo: { path: "/backup" },
	},
];

function mountDialog(
	onTestFinished: TestContext["onTestFinished"],
	props: Pick<MoveCopyMediaDialogProps, "onConfirm" | "isSubmitting" | "error">,
) {
	const [open, setOpen] = createSignal(true);
	onTestFinished(
		renderComponent(() => (
			<MoveCopyMediaDialog
				currentSourceId={CURRENT_SOURCE_ID}
				listSources={async () => SOURCES}
				mode="copy"
				onOpenChange={setOpen}
				open={open()}
				{...props}
			/>
		)),
	);

	const dialog = page.getByRole("dialog", {
		name: t("moveCopyMediaDialog.copyMedia"),
		exact: true,
	});
	return {
		dialog,
		copyButton: dialog.getByRole("button", {
			name: t("moveCopyMediaDialog.copy"),
			exact: true,
		}),
		destination: dialog.getByRole("combobox", {
			name: new RegExp(`^${t("moveCopyMediaDialog.destinationSource")}`),
		}),
	};
}

test("chooses a different source with the keyboard and submits its ID", async ({
	onTestFinished,
}) => {
	const onConfirm = vi.fn<(sourceId: string) => Promise<void>>(async () => {});
	const { dialog, destination, copyButton } = mountDialog(onTestFinished, {
		isSubmitting: false,
		onConfirm,
	});

	await expect.element(copyButton).toBeDisabled();
	await expect.element(destination).toBeEnabled();
	destination.element().focus();
	await userEvent.keyboard("{ArrowDown}");

	const list = dialog.getByRole("listbox");
	await expect.element(list).toBeVisible();
	await expect
		.element(list.getByRole("option", { name: "Current source", exact: true }))
		.not.toBeInTheDocument();
	await expect
		.element(list.getByRole("option", { name: "Archive", exact: true }))
		.toHaveFocus();
	await userEvent.keyboard("{ArrowDown}{Enter}");

	await expect.element(list).not.toBeInTheDocument();
	await expect.element(destination).toHaveTextContent("Backup");
	await expect.element(copyButton).toBeEnabled();
	await copyButton.click();
	expect(onConfirm).toHaveBeenCalledExactlyOnceWith(BACKUP_SOURCE_ID);
});

test("guards the pending copy and keeps the selected destination after an error", async ({
	onTestFinished,
}) => {
	const request = Promise.withResolvers<string>();
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal<string>();
	const { dialog, destination, copyButton } = mountDialog(onTestFinished, {
		get isSubmitting() {
			return pending();
		},
		get error() {
			return error();
		},
		onConfirm: async () => {
			setPending(true);
			setError(await request.promise);
			setPending(false);
		},
	});
	const close = dialog.getByRole("button", {
		name: t("actions.close"),
		exact: true,
	});
	const cancel = dialog.getByRole("button", {
		name: t("actions.cancel"),
		exact: true,
	});

	await destination.click();
	await dialog.getByRole("option", { name: "Archive", exact: true }).click();
	await copyButton.click();
	const processing = dialog.getByRole("button", {
		name: t("status.processing"),
		exact: true,
	});
	await expect.element(processing).toBeDisabled();
	await expect.element(processing).toHaveAttribute("aria-busy", "true");
	await expect.element(destination).toBeDisabled();
	await expect.element(close).toBeDisabled();
	await expect.element(cancel).toBeDisabled();
	await userEvent.keyboard("{Escape}");
	await expect.element(dialog).toBeVisible();

	request.resolve("The archive is unavailable.");
	await expect
		.element(dialog.getByRole("alert"))
		.toHaveTextContent("The archive is unavailable.");
	await expect.element(destination).toHaveTextContent("Archive");
	await expect.element(copyButton).toBeEnabled();
	await cancel.click();
	await expect.element(dialog).not.toBeInTheDocument();
});
