import type { Media } from "@solid-imager/core/media";
import { t } from "@solid-imager/i18n";
import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { SourceMediaGrid } from "../source-media-grid";
import { ProSearchBuilder } from "../pro-search-builder";
import { SearchComposer, type SearchToken } from "../workspace/search-composer";
import { renderComponent } from "./render-component";

const filterData = {
	authors: [],
	characters: [],
	ips: [],
	projects: [],
	tags: [
		{
			id: "00000000-0000-4000-8000-000000000001",
			name: "night_sky",
			description: null,
			attribute: null,
			color: null,
			source: "manual",
			authorId: null,
			createdAt: new Date(0),
			updatedAt: new Date(0),
		},
	],
};

test("empty Backspace removes the last removable token beyond the visible four", async ({
	onTestFinished,
}) => {
	const tokens: SearchToken[] = Array.from({ length: 6 }, (_, i) => ({
		key: "selectedTags",
		prefix: "tag",
		value: String(i),
		removable: i !== 5,
	}));
	const remove = vi.fn();
	onTestFinished(
		renderComponent(() => (
			<SearchComposer
				draft=""
				tokens={tokens}
				filterData={filterData}
				onDraftChange={() => {}}
				onRemoveToken={remove}
				onSelectSuggestion={() => {}}
				onSubmit={() => {}}
			/>
		)),
	);
	await page
		.getByRole("combobox", { name: t("searchComposer.searchMedia") })
		.click();
	await userEvent.keyboard("{Backspace}");
	expect(remove).toHaveBeenCalledExactlyOnceWith(tokens[4]);
});

test("hides old suggestions while the next prefix is debouncing", async ({
	onTestFinished,
}) => {
	const [draft, setDraft] = createSignal("");
	const selected = vi.fn();
	onTestFinished(() => {
		vi.useRealTimers();
	});
	onTestFinished(
		renderComponent(() => (
			<SearchComposer
				draft={draft()}
				tokens={[]}
				filterData={filterData}
				onDraftChange={setDraft}
				onRemoveToken={() => {}}
				onSelectSuggestion={selected}
				onSubmit={() => {}}
			/>
		)),
	);
	const input = page.getByRole("combobox", {
		name: t("searchComposer.searchMedia"),
	});
	await input.fill("tag:night");
	const option = page.getByRole("option", { name: "night_sky", exact: true });
	await expect.element(option).toBeVisible();
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	setDraft("author:night");
	await expect.element(option).not.toBeInTheDocument();
	await userEvent.keyboard("{Enter}");
	expect(selected).not.toHaveBeenCalled();
});

test("mounts cached grid and list data with working action menus", async ({
	onTestFinished,
}) => {
	const media: Media = {
		id: "00000000-0000-4000-8000-000000000001",
		mediaSourceId: "00000000-0000-4000-8000-000000000002",
		filePath: "cached.png",
		fileName: "cached.png",
		mediaType: "image",
		width: 100,
		height: 100,
		fileSize: 100,
		description: null,
		createdAt: new Date(0),
		modifiedAt: new Date(0),
		indexedAt: new Date(0),
		status: "active",
	};
	const open = vi.fn();
	const [viewMode, setViewMode] = createSignal<"grid" | "list">("grid");
	onTestFinished(
		renderComponent(() => (
			<SourceMediaGrid
				mediaResults={() => [media]}
				mediaSourceId={() => media.mediaSourceId}
				state={() => ({
					phase: "data",
					fetchState: "idle",
					data: [media],
					error: undefined,
				})}
				isFetchingNextPage={false}
				setLoadMoreRef={() => {}}
				renderItem={(item) => <span>{item.fileName}</span>}
				onOpenMediaDetail={open}
				viewMode={viewMode}
			/>
		)),
	);
	const menuTrigger = page.getByRole("button", {
		name: t("sourceList.actionsForValue", { value0: media.fileName }),
	});
	await menuTrigger.click();
	await page
		.getByRole("menuitem", {
			name: t("collectionInspector.openDetails"),
			exact: false,
		})
		.click();
	expect(open).toHaveBeenCalledExactlyOnceWith(media);
	setViewMode("list");
	await expect.element(page.getByRole("table")).toBeVisible();
});

test("explains the UTC calendar used by date search", async ({
	onTestFinished,
}) => {
	onTestFinished(
		renderComponent(() => (
			<ProSearchBuilder
				value={{
					type: "group",
					operator: "and",
					children: [
						{
							type: "criterion",
							target: "createdAt",
							operator: "equals",
							value: "2026-11-21",
						},
					],
				}}
				onChange={() => {}}
			/>
		)),
	);
	await expect
		.element(page.getByText(t("proSearchBuilder.utcDateHint")))
		.toBeVisible();
});
