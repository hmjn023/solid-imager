import { t } from "@solid-imager/i18n";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { resetSearchState, searchState } from "../stores/search-store";
import { SearchToolbar } from "../workspace/search-toolbar";
import { renderComponent } from "./render-component";

const TAG_NAME = "night_sky";

test("clearing filters cancels a queued search suggestion", async ({
	onTestFinished,
}) => {
	await page.viewport(1024, 768);
	resetSearchState();
	const searches: string[][] = [];
	const dispose = renderComponent(() => (
		<SearchToolbar
			context="global"
			filterData={{
				authors: [],
				characters: [],
				ips: [],
				projects: [],
				tags: [
					{
						id: "00000000-0000-4000-8000-000000000001",
						name: TAG_NAME,
						description: null,
						attribute: null,
						color: null,
						source: "manual",
						authorId: null,
						createdAt: new Date(0),
						updatedAt: new Date(0),
					},
				],
			}}
			onSearch={() => {
				searches.push([...searchState.selectedTags]);
			}}
			presetClient={{
				list: async () => [],
				create: async () => {},
				delete: async () => {},
			}}
			sourceName="Test library"
		/>
	));
	onTestFinished(() => {
		dispose();
		vi.useRealTimers();
		resetSearchState();
	});

	const input = page.getByRole("combobox", {
		name: t("searchComposer.searchMedia"),
	});
	await input.fill("tag:night");
	const suggestion = page.getByRole("option", { name: TAG_NAME, exact: true });
	await expect.element(suggestion).toBeVisible();

	// Freeze the debounce only after the browser has rendered the suggestion.
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	await suggestion.click();
	const chip = page.getByRole("button", {
		name: t("searchComposer.removeValueValue", {
			value0: "tag",
			value1: TAG_NAME,
		}),
	});
	await expect.element(chip).toBeVisible();
	expect(searches).toEqual([]);

	await page
		.getByRole("button", {
			name: t("searchToolbar.searchFiltersValueConditions", { value0: "0" }),
		})
		.click();
	await page
		.getByRole("button", { name: t("searchToolbar.clearAll"), exact: true })
		.click();
	vi.runOnlyPendingTimers();

	await expect.element(chip).not.toBeInTheDocument();
	expect(searches).toEqual([[]]);
});
