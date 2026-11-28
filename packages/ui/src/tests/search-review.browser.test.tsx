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

test("reuses the action menu while selecting the current grid or list item", async ({
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
	const video: Media = {
		...media,
		id: "00000000-0000-4000-8000-000000000003",
		filePath: "cached.webm",
		fileName: "cached.webm",
		mediaType: "video",
	};
	const open = vi.fn();
	const preview = vi.fn();
	const [results, setResults] = createSignal([media, video]);
	const [viewMode, setViewMode] = createSignal<"grid" | "list">("grid");
	onTestFinished(
		renderComponent(() => (
			<SourceMediaGrid
				mediaResults={results}
				mediaSourceId={() => media.mediaSourceId}
				state={() => ({
					phase: "data",
					fetchState: "idle",
					data: results(),
					error: undefined,
				})}
				isFetchingNextPage={false}
				setLoadMoreRef={() => {}}
				renderItem={(item) => <span>{item.fileName}</span>}
				onOpenMediaDetail={open}
				onPreviewSelect={preview}
				viewMode={viewMode}
			/>
		)),
	);
	const triggerFor = (fileName: string) =>
		page.getByRole("button", {
			name: t("sourceList.actionsForValue", { value0: fileName }),
			exact: true,
		});
	const imageTrigger = triggerFor(media.fileName);
	const videoTrigger = triggerFor(video.fileName);
	const menu = page.getByRole("menu");
	const openDetails = menu.getByRole("menuitem", {
		name: t("collectionInspector.openDetails"),
	});
	const copyImage = menu.getByRole("menuitem", {
		name: t("actions.copyImage"),
	});
	await imageTrigger.click();
	await expect.element(copyImage).toBeVisible();
	const openMenu = menu.element();
	await videoTrigger.click();
	await expect.element(videoTrigger).toHaveAttribute("aria-expanded", "true");
	await expect.element(imageTrigger).toHaveAttribute("aria-expanded", "false");
	await expect.element(copyImage).not.toBeInTheDocument();
	expect(menu.element()).toBe(openMenu);
	await openDetails.click();
	expect(open).toHaveBeenCalledExactlyOnceWith(video);
	await expect.element(videoTrigger).toHaveFocus();

	setViewMode("list");
	await expect.element(page.getByRole("table")).toBeVisible();
	await imageTrigger.click();
	await expect.element(copyImage).toBeVisible();
	const updatedMedia = { ...media, fileName: "updated.png" };
	setResults([updatedMedia, video]);
	await expect.element(menu.getByText(updatedMedia.fileName)).toBeVisible();
	await userEvent.keyboard("{Escape}");
	const updatedTrigger = triggerFor(updatedMedia.fileName);
	await expect.element(updatedTrigger).toHaveFocus();
	await updatedTrigger.click();
	await openDetails.click();
	expect(open).toHaveBeenCalledTimes(2);
	expect(open).toHaveBeenLastCalledWith(updatedMedia);
	expect(preview).not.toHaveBeenCalled();
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

test("measures mobile bulk rows and preserves DOM for rows that stay in the virtual range", async ({
	onTestFinished,
}) => {
	await page.viewport(390, 640);
	const mediaResults: Media[] = Array.from({ length: 140 }, (_, index) => ({
		id: `media-${index}`,
		mediaSourceId: "source",
		filePath: `image-${index}.png`,
		fileName: `image-${index}.png`,
		mediaType: "image",
		width: 100,
		height: 100,
		fileSize: 100,
		description: null,
		createdAt: new Date(0),
		modifiedAt: new Date(0),
		indexedAt: new Date(0),
		status: "active",
	}));
	const [results, setResults] = createSignal(mediaResults.slice(0, 99));
	const [bulk, setBulk] = createSignal(false);
	onTestFinished(
		renderComponent(() => (
			<div
				class="h-72 overflow-y-auto"
				data-media-scroll
				data-testid="list-scroll"
			>
				<SourceMediaGrid
					enableVirtualization
					isBulkSelectMode={bulk}
					isFetchingNextPage={false}
					mediaResults={results}
					mediaSourceId={() => "source"}
					onOpenMediaDetail={() => {}}
					renderItem={() => null}
					scrollMode="element"
					setLoadMoreRef={() => {}}
					state={() => ({
						phase: "data",
						fetchState: "idle",
						data: results(),
						error: undefined,
					})}
					viewMode={() => "list"}
				/>
			</div>
		)),
	);
	const scroll = page.getByTestId("list-scroll").element();
	const rows = () => [
		...scroll.querySelectorAll<HTMLTableRowElement>("tr[data-index]"),
	];
	const retainedRow = () =>
		scroll.querySelector<HTMLTableRowElement>('tr[data-media-id="media-4"]');
	await expect.poll(() => rows().length).toBe(99);
	const row = retainedRow();
	row?.focus();
	expect(document.activeElement).toBe(row);

	setResults(mediaResults.slice(0, 100));
	await expect.poll(() => rows().length).toBe(100);
	expect(retainedRow()).toBe(row);
	setResults(mediaResults);
	await expect.poll(() => rows().length).toBeLessThan(30);
	expect(retainedRow()).toBe(row);

	setBulk(true);
	await expect
		.poll(() => row?.getBoundingClientRect().height)
		.toBeGreaterThan(56);
	const lastIndexBeforeScroll = rows().at(-1)?.dataset.index;
	scroll.scrollTop = 300;
	await expect
		.poll(() => rows().at(-1)?.dataset.index)
		.not.toBe(lastIndexBeforeScroll);
	expect(retainedRow()).toBe(row);
	expect(document.activeElement).toBe(row);

	const trigger = page.getByRole("button", {
		name: t("sourceList.actionsForValue", { value0: "image-4.png" }),
		exact: true,
	});
	const menu = page.getByRole("menu");
	const collection = page
		.getByRole("region", { name: t("sourceMediaGrid.mediaListActionTarget") })
		.element()
		.closest('[tabindex="-1"]');
	expect(collection).not.toBeNull();
	await trigger.click();
	await expect.element(menu).toBeVisible();
	scroll.scrollTop = 1500;
	await expect.poll(() => Number(rows()[0]?.dataset.index)).toBeGreaterThan(10);
	await expect.element(trigger).not.toBeInTheDocument();
	await expect.element(menu).not.toBeInTheDocument();
	await expect.poll(() => document.activeElement).toBe(collection);
	expect(scroll.scrollTop).toBe(1500);
	const firstIndex = Number(rows()[0]?.dataset.index);
	const spacerHeight = scroll
		.querySelector("tbody tr[aria-hidden] div")
		?.getBoundingClientRect().height;
	expect(spacerHeight).toBeGreaterThan(firstIndex * 56);
});
