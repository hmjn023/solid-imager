import { t } from "@solid-imager/i18n";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { MediaViewer } from "../media-viewer";
import { renderComponent } from "./render-component";

test("shows retry when the browser cannot decode a resolved image URL", async ({
	onTestFinished,
}) => {
	const getUrl = vi
		.fn<() => string>()
		.mockReturnValueOnce("data:image/png;base64,AAAA")
		.mockReturnValueOnce(
			"data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
		);
	onTestFinished(
		renderComponent(() => (
			<MediaViewer fileName="preview.png" source={{ type: "image", getUrl }} />
		)),
	);

	await expect
		.element(page.getByText(t("mediaViewer.imagePreviewUnavailable")))
		.toBeVisible();
	await page.getByRole("button", { name: t("actions.retry") }).click();
	const image = page.getByRole("img", { name: "preview.png" });
	await expect
		.poll(() => {
			const element = image.query();
			return element instanceof HTMLImageElement ? element.naturalWidth : 0;
		})
		.toBe(1);
	expect(getUrl).toHaveBeenCalledTimes(2);
});
