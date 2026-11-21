import { t } from "@solid-imager/i18n";
import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { UploadMediaModal } from "../upload-media-modal";
import { renderComponent } from "./render-component";

const ONE_PIXEL_PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("previews a dropped image and includes it in the upload", async ({
	onTestFinished,
}) => {
	const file = new File(
		[Uint8Array.from(atob(ONE_PIXEL_PNG), (byte) => byte.charCodeAt(0))],
		"dropped-image.png",
		{ type: "image/png" },
	);
	const onUploadStart = vi.fn(async () => {});
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
	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	dropZone
		.element()
		.dispatchEvent(
			new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }),
		);

	await expect
		.element(dialog.getByRole("listitem").getByText(file.name, { exact: true }))
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
	await expect.element(dialog).not.toBeInTheDocument();
	expect(onUploadStart).toHaveBeenCalledExactlyOnceWith(
		expect.objectContaining({ files: [file], filename: file.name }),
	);
});
