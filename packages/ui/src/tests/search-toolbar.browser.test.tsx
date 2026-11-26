import { t } from "@solid-imager/i18n";
import { flush } from "solid-js";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	resetSearchState,
	searchState,
	setSearchState,
} from "../stores/search-store";
import { SearchToolbar } from "../workspace/search-toolbar";
import { renderComponent } from "./render-component";

const TAG_NAME = "night_sky";

test("commits a queued filename when closing filters and preserves external updates", async ({
	onTestFinished,
}) => {
	await page.viewport(1024, 768);
	resetSearchState();
	const onSearch = vi.fn(() => searchState.searchQuery);
	const dispose = renderComponent(() => (
		<SearchToolbar
			context="global"
			filterData={{
				authors: [],
				characters: [],
				ips: [],
				projects: [],
				tags: [],
			}}
			onSearch={onSearch}
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

	const openFilters = page.getByRole("button", {
		name: new RegExp(`^${t("searchToolbar.searchFilters")}`),
	});
	await openFilters.click();
	const filename = page.getByRole("textbox", {
		name: t("searchFilters.filenameSearch"),
	});
	await expect.element(filename).toBeVisible();
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	await filename.fill("stale.png");
	setSearchState((draft) => {
		draft.searchQuery = "restored.png";
	});
	flush();
	vi.advanceTimersByTime(250);
	expect(searchState.searchQuery).toBe("restored.png");
	await expect.element(filename).toHaveValue("restored.png");

	await filename.fill("before composition");
	filename
		.element()
		.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
	vi.advanceTimersByTime(250);
	expect(searchState.searchQuery).toBe("restored.png");
	await filename.fill("猫.png");
	filename
		.element()
		.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
	expect(searchState.searchQuery).toBe("restored.png");

	await userEvent.keyboard("{Escape}");
	await expect.element(filename).not.toBeInTheDocument();
	expect(searchState.searchQuery).toBe("猫.png");
	expect(onSearch).toHaveReturnedWith("猫.png");

	await openFilters.click();
	await expect.element(filename).toHaveValue("猫.png");
	await page
		.getByRole("button", { name: t("actions.close"), exact: true })
		.click();
	expect(onSearch).toHaveBeenCalledTimes(1);
});

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
