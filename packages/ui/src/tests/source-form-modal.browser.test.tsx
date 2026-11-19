import type { SafeMediaSource } from "@solid-imager/core/sources";
import { t } from "@solid-imager/i18n";
import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Button } from "../button";
import {
	SourceFormModal,
	type SourceFormSubmitData,
} from "../source-form-modal";
import { renderComponent } from "./render-component";

test("keeps source fields after a failed save and resubmits them on retry", async ({
	onTestFinished,
}) => {
	const firstSave = Promise.withResolvers<void>();
	const [open, setOpen] = createSignal(true);
	const onSubmit = vi.fn<(source: SourceFormSubmitData) => Promise<void>>(
		async () => {
			setOpen(false);
		},
	);
	onSubmit.mockReturnValueOnce(firstSave.promise);
	onTestFinished(
		renderComponent(() => (
			<SourceFormModal
				isOpen={open()}
				onClose={() => setOpen(false)}
				onSubmit={onSubmit}
			/>
		)),
	);

	const dialog = page.getByRole("dialog", {
		name: t("sourceFormModal.addNewSource"),
	});
	const name = dialog.getByRole("textbox", { name: t("labels.name") });
	const path = dialog.getByRole("textbox", {
		name: t("sourceFormModal.directoryPath"),
	});
	const add = dialog.getByRole("button", { name: t("actions.addSource") });
	const source = {
		name: "Illustration library",
		description: null,
		type: "local",
		connectionInfo: { path: "/library/illustrations" },
	};
	await name.fill(source.name);
	await path.fill(source.connectionInfo.path);
	await userEvent.keyboard("{Enter}");
	const saving = dialog.getByRole("button", { name: t("status.saving") });
	await expect.element(saving).toBeDisabled();
	expect(onSubmit).toHaveBeenCalledExactlyOnceWith(source);

	firstSave.reject(new Error("The source is temporarily unavailable."));
	await expect
		.element(dialog.getByRole("alert"))
		.toHaveTextContent("The source is temporarily unavailable.");
	await expect.element(name).toHaveValue(source.name);
	await expect.element(path).toHaveValue(source.connectionInfo.path);
	await expect.element(add).toBeEnabled();
	await add.click();
	await expect.element(dialog).not.toBeInTheDocument();
	expect(onSubmit.mock.calls).toEqual([[source], [source]]);
});

test("dismisses source discard confirmation independently and resets the draft after discard", async ({
	onTestFinished,
}) => {
	const source: SafeMediaSource = {
		id: "00000000-0000-4000-8000-000000000001",
		name: "Illustration library",
		description: null,
		type: "local",
		connectionInfo: { path: "/library/illustrations" },
	};
	const [open, setOpen] = createSignal(false);
	const onSubmit = vi.fn();
	onTestFinished(
		renderComponent(() => (
			<>
				<Button onClick={() => setOpen(true)}>{t("actions.edit")}</Button>
				<SourceFormModal
					editingSource={source}
					isOpen={open()}
					onClose={() => setOpen(false)}
					onSubmit={onSubmit}
				/>
			</>
		)),
	);

	const edit = page.getByRole("button", {
		name: t("actions.edit"),
		exact: true,
	});
	const dialog = page.getByRole("dialog", {
		name: t("sourceFormModal.editSource"),
	});
	const name = dialog.getByRole("textbox", { name: t("labels.name") });
	const confirm = page.getByRole("alertdialog", {
		name: t("sourceFormModal.discardSourceChanges"),
	});
	await edit.click();
	await name.fill("Edited source name");
	await userEvent.keyboard("{Escape}");
	await expect.element(confirm).toBeVisible();
	await userEvent.keyboard("{Escape}");
	await expect.element(confirm).not.toBeInTheDocument();
	await expect.element(dialog).toBeVisible();
	await expect.element(name).toHaveValue("Edited source name");

	await dialog.getByRole("button", { name: t("actions.cancel") }).click();
	await confirm
		.getByRole("button", { name: t("sourceFormModal.discardChanges") })
		.click();
	await expect.element(dialog).not.toBeInTheDocument();
	await expect.element(confirm).not.toBeInTheDocument();
	await expect.element(edit).toHaveFocus();
	await edit.click();
	await expect.element(name).toHaveValue(source.name);
	expect(onSubmit).not.toHaveBeenCalled();
});
