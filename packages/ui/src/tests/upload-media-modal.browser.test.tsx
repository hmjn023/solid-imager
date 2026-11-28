import { t } from "@solid-imager/i18n";
import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { UploadMediaModal } from "../upload-media-modal";
import { renderComponent } from "./render-component";

const ONE_PIXEL_PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function dropFiles(target: Element, ...files: File[]) {
	const dataTransfer = new DataTransfer();
	for (const file of files) dataTransfer.items.add(file);
	target.dispatchEvent(
		new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }),
	);
}

test("previews and appends dropped files before upload", async ({
	onTestFinished,
}) => {
	const file = new File(
		[Uint8Array.from(atob(ONE_PIXEL_PNG), (byte) => byte.charCodeAt(0))],
		"dropped-image.png",
		{ type: "image/png" },
	);
	const second = new File([file], "second-image.png", { type: file.type });
	const duplicate = new File([file], file.name, {
		type: file.type,
		lastModified: file.lastModified,
	});
	const pending = Promise.withResolvers<void>();
	const onUploadStart = vi.fn(() => pending.promise);
	const [open, setOpen] = createSignal(true);
	onTestFinished(
		renderComponent(() => (
			<UploadMediaModal
				initialFile={null}
				isOpen={open()}
				onClose={() => setOpen(false)}
				onUploadStart={onUploadStart}
				pastedUrl={null}
			/>
		)),
	);

	const dialog = page.getByRole("dialog", {
		name: t("uploadMediaModal.uploadMedia"),
	});
	const dropZone = dialog
		.getByRole("button")
		.filter({ hasText: t("uploadMediaModal.dragAndDropFiles") });
	await expect.element(dropZone).toBeVisible();
	dropFiles(dropZone.element(), file);

	const files = dialog.getByRole("listitem");
	const firstItem = files.getByText(file.name, { exact: true });
	await expect.element(firstItem).toBeVisible();
	dropFiles(firstItem.element(), duplicate, second);
	await expect.element(files).toHaveLength(2);
	await expect
		.element(files.getByText(second.name, { exact: true }))
		.toBeVisible();
	await expect
		.element(dialog.getByLabelText(t("uploadMediaModal.filename")))
		.toHaveValue(file.name);
	const preview = dialog.getByRole("img", {
		name: t("uploadMediaModal.fetchedPreview"),
	});
	await expect.element(preview).toBeVisible();
	await expect
		.poll(() => {
			const image = preview.element();
			return image instanceof HTMLImageElement ? image.naturalWidth : 0;
		})
		.toBe(1);

	await dialog
		.getByRole("button", { name: t("uploadMediaModal.upload"), exact: true })
		.click();
	await expect
		.element(
			dialog.getByRole("button", { name: t("uploadMediaModal.addFiles") }),
		)
		.toBeDisabled();
	dropFiles(firstItem.element(), new File([file], "ignored.png"));
	await expect.element(files).toHaveLength(2);
	pending.resolve();
	await expect.element(dialog).not.toBeInTheDocument();
	expect(onUploadStart).toHaveBeenCalledExactlyOnceWith(
		expect.objectContaining({ files: [file, second], filename: file.name }),
	);
});
