import { t } from "@solid-imager/i18n";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { DropdownMenuItem } from "../dropdown-menu";
import { ViewerActionsMenu } from "../external-viewer/actions-menu";
import { renderComponent } from "./render-component";

test("navigates the viewer actions with the keyboard and restores trigger focus", async ({
	onTestFinished,
}) => {
	const siteUrl = "https://www.pixiv.net/";
	const openHistory = vi.fn();
	onTestFinished(
		renderComponent(() => (
			<ViewerActionsMenu siteUrl={siteUrl}>
				<DropdownMenuItem onSelect={openHistory}>
					{t("pixivViewingHistory.title")}
				</DropdownMenuItem>
			</ViewerActionsMenu>
		)),
	);

	const trigger = page.getByRole("button", {
		name: t("mediaActions.moreActions"),
	});
	const menu = page.getByRole("menu");
	const history = menu.getByRole("menuitem", {
		name: t("pixivViewingHistory.title"),
	});
	const openSite = menu.getByRole("menuitem", {
		name: t("workspace.openSite"),
	});

	await userEvent.tab();
	await expect.element(trigger).toHaveFocus();
	await userEvent.keyboard("{ArrowDown}");
	await expect.element(history).toHaveFocus();
	await userEvent.keyboard("{ArrowDown}");
	await expect.element(openSite).toHaveFocus();
	await expect.element(openSite).toHaveAttribute("href", siteUrl);
	await expect.element(openSite).toHaveAttribute("target", "_blank");
	await expect.element(openSite).toHaveAttribute("rel", "noopener noreferrer");

	await userEvent.keyboard("{Escape}");
	await expect.element(menu).not.toBeInTheDocument();
	await expect.element(trigger).toHaveFocus();
	expect(openHistory).not.toHaveBeenCalled();

	await userEvent.keyboard("{ArrowDown}");
	await expect.element(history).toHaveFocus();
	await userEvent.keyboard("{Enter}");
	expect(openHistory).toHaveBeenCalledTimes(1);
	await expect.element(menu).not.toBeInTheDocument();
	await expect.element(trigger).toHaveFocus();
});
