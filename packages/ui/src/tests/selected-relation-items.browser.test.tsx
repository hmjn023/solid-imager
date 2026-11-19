import { t } from "@solid-imager/i18n";
import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { SelectedRelationItems } from "../selected-relation-items";
import { renderComponent } from "./render-component";

test("keeps keyboard focus in the selected relations after removing a chip", async ({
	onTestFinished,
}) => {
	const savedItem = { id: "ip-1", name: "巡りの森" };
	const stagedName = "星の旅";
	const removeSaved = vi.fn();
	const removeStaged = vi.fn();

	onTestFinished(
		renderComponent(() => {
			const [items, setItems] = createSignal([savedItem]);
			const [names, setNames] = createSignal([stagedName]);
			return (
				<SelectedRelationItems
					items={items()}
					onRemove={(id) => {
						removeSaved(id);
						setItems((current) => current.filter((item) => item.id !== id));
					}}
					staged={{
						names: names(),
						onRemove: (name) => {
							removeStaged(name);
							setNames((current) => current.filter((item) => item !== name));
						},
					}}
				/>
			);
		}),
	);

	const heading = page.getByRole("heading", {
		name: t("relationsEditor.selectedItems"),
	});
	const savedChip = page.getByRole("button", {
		name: t("relationsEditor.removeSelection", { name: savedItem.name }),
	});
	const stagedChip = page.getByRole("button", {
		name: t("relationsEditor.removeSelection", { name: stagedName }),
	});

	await userEvent.tab();
	await expect.element(savedChip).toHaveFocus();
	await userEvent.keyboard("{Enter}");
	expect(removeSaved).toHaveBeenCalledWith(savedItem.id);
	await expect.element(savedChip).not.toBeInTheDocument();
	await expect.element(heading).toHaveFocus();

	await userEvent.tab();
	await expect.element(stagedChip).toHaveFocus();
	await userEvent.keyboard("{Enter}");
	expect(removeStaged).toHaveBeenCalledWith(stagedName);
	await expect.element(stagedChip).not.toBeInTheDocument();
	await expect
		.element(page.getByText(t("relationsEditor.noneSelected")))
		.toBeVisible();
	await expect.element(heading).toHaveFocus();
});
