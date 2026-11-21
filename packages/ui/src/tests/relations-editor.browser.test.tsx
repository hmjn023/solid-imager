import { t } from "@solid-imager/i18n";
import { createSignal } from "solid-js";
import { expect, test, type TestContext, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { RelationsEditor } from "../relations-editor";
import { renderComponent } from "./render-component";

const IP_TITLE = "IP";
const ORIGINAL = { id: "ip-1", name: "Forest story" };
const LOCAL = { id: "ip-2", name: "Ocean story" };
const REMOTE = { id: "ip-3", name: "Night story" };

function mountEditor(onTestFinished: TestContext["onTestFinished"]) {
	const [items, setItems] = createSignal([ORIGINAL]);
	const add = vi.fn<(id: string) => void>();
	const remove = vi.fn<(id: string) => void>();
	const emptyGroup = {
		items: [],
		available: [],
		add,
		remove,
		create: async () => ({ id: "new-item" }),
	};
	onTestFinished(
		renderComponent(() => (
			<RelationsEditor
				groups={{
					projects: { ...emptyGroup, title: "Projects" },
					ips: {
						...emptyGroup,
						title: IP_TITLE,
						items: items(),
						available: [ORIGINAL, LOCAL],
					},
					characters: { ...emptyGroup, title: "Characters" },
				}}
			/>
		)),
	);

	const dialog = page.getByRole("dialog", {
		name: t("relationsEditor.editRelations"),
	});
	return {
		add,
		remove,
		dialog,
		edit: page.getByRole("button", { name: t("actions.edit"), exact: true }),
		save: dialog.getByRole("button", { name: t("actions.saveChanges") }),
		remote: dialog.getByRole("checkbox", { name: REMOTE.name, exact: true }),
		refresh: () => setItems([ORIGINAL, REMOTE]),
	};
}

test("retains the search field without marking a background relation update as an edit", async ({
	onTestFinished,
}) => {
	const { dialog, edit, save, remote, refresh } = mountEditor(onTestFinished);
	await edit.click();
	const search = dialog.getByRole("searchbox", {
		name: t("relationsEditor.searchValue", { value0: IP_TITLE }),
	});
	await search.fill("Night");
	await expect.element(remote).not.toBeInTheDocument();
	refresh();

	await expect.element(remote).toBeVisible();
	await expect.element(search).toHaveValue("Night");
	await expect.element(search).toHaveFocus();
	await expect.element(save).toBeDisabled();
	await userEvent.keyboard("{Escape}");
	await expect.element(dialog).not.toBeInTheDocument();
	await expect.element(edit).toHaveFocus();

	await edit.click();
	await expect.element(remote).toBeChecked();
});

test("saves only the user's relation changes when an external relation arrives during editing", async ({
	onTestFinished,
}) => {
	const { add, remove, dialog, edit, save, remote, refresh } =
		mountEditor(onTestFinished);
	await edit.click();
	await dialog.getByText(LOCAL.name, { exact: true }).click();
	const local = dialog.getByRole("checkbox", { name: LOCAL.name, exact: true });
	await expect.element(local).toBeChecked();
	refresh();

	await expect.element(remote).toBeVisible();
	await expect.element(local).toBeChecked();
	await save.click();
	await expect.element(dialog).not.toBeInTheDocument();
	expect(add).toHaveBeenCalledExactlyOnceWith(LOCAL.id);
	expect(remove).not.toHaveBeenCalled();
});
