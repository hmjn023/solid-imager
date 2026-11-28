import { t } from "@solid-imager/i18n";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { toast, Toaster } from "../toast";
import { renderComponent } from "./render-component";

test("updates an early loading toast and restores focus after its action", async ({
	onTestFinished,
}) => {
	const openJobs = vi.fn();
	const id = toast.loading("Preparing files", { id: "prepare-files" });
	const dispose = renderComponent(() => (
		<>
			<button type="button">Open source</button>
			<Toaster />
		</>
	));
	onTestFinished(() => {
		toast.dismiss(id);
		dispose();
	});
	const origin = page.getByRole("button", { name: "Open source" });
	origin.element().focus();
	const notifications = page.getByRole("region", {
		name: t("toast.notifications"),
	});
	await expect
		.element(notifications.getByText("Preparing files"))
		.toBeVisible();
	await expect.element(notifications.getByRole("button")).toHaveLength(0);

	expect(
		toast.success("Files ready", {
			id,
			description: "Two files",
			duration: Infinity,
			action: { label: t("actions.viewJobs"), onClick: openJobs },
		}),
	).toBe(id);
	await expect.element(notifications.getByRole("listitem")).toHaveLength(1);
	await expect.element(notifications.getByText("Two files")).toBeVisible();
	await expect.element(origin).toHaveFocus();
	await userEvent.keyboard("{Alt>}t{/Alt}");
	await expect.element(notifications.getByRole("listitem")).toHaveFocus();
	const action = notifications.getByRole("button", {
		name: t("actions.viewJobs"),
	});
	await userEvent.tab();
	await expect.element(action).toHaveFocus();
	await userEvent.keyboard("{Enter}");
	expect(openJobs).toHaveBeenCalledOnce();
	await expect.element(notifications).not.toBeInTheDocument();
	await expect.element(origin).toHaveFocus();
});
