import {
	TAG_DICTIONARY_PAGE_SIZE,
	type TagDictionarySearchResult,
} from "@solid-imager/core/tags";
import { t } from "@solid-imager/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createSignal } from "solid-js";
import { expect, test, type TestContext, vi } from "vitest";
import { page } from "vitest/browser";
import { MediaTagEditor } from "../media-tag-editor";
import type { TagDictionaryLookup } from "../tag-dictionary-browser";
import { renderComponent } from "./render-component";

const TAG_NAME = "wavy_hair";
const JAPANESE_NAME = "ウェーブヘア";
const DICTIONARY_ENTRY: TagDictionarySearchResult["items"][number] = {
	name: TAG_NAME,
	category: 0,
	postCount: 1,
	japanese: JAPANESE_NAME,
	aliases: [],
	wikiNames: [],
	attributes: [],
};
const DICTIONARY: TagDictionaryLookup = {
	dictionarySearch: async ({ query }) => ({
		items: query === TAG_NAME ? [DICTIONARY_ENTRY] : [],
		hasMore: false,
	}),
	dictionaryDetail: async () => null,
};

async function openTagEditor(
	onTestFinished: TestContext["onTestFinished"],
	dictionary: TagDictionaryLookup,
) {
	await page.viewport(390, 844);
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const onSave = vi.fn(async () => {});
	const [open, setOpen] = createSignal(false);
	const dispose = renderComponent(() => (
		<QueryClientProvider client={queryClient}>
			<MediaTagEditor
				tags={[]}
				dictionary={dictionary}
				open={open()}
				onOpenChange={setOpen}
				onDirtyChange={() => {}}
				onSave={onSave}
			/>
		</QueryClientProvider>
	));
	onTestFinished(() => {
		dispose();
		queryClient.clear();
	});
	await page.getByRole("button", { name: t("actions.edit") }).click();
	const dialog = page.getByRole("dialog", { name: t("mediaTagEditor.title") });
	const input = dialog.getByRole("combobox", {
		name: t("mediaTagEditor.tagNames"),
	});
	const options = dialog.getByRole("listbox").getByRole("option");
	return { dialog, input, options, onSave };
}

test.for([
	{ option: "create", index: 0, fromDictionary: false },
	{ option: "dictionary match", index: 1, fromDictionary: true },
])(
	"saves the $option choice for an exact match",
	async ({ index, fromDictionary }, { onTestFinished }) => {
		const { dialog, input, options, onSave } = await openTagEditor(
			onTestFinished,
			DICTIONARY,
		);
		await input.fill(TAG_NAME);
		await expect
			.element(options.nth(0))
			.toHaveTextContent(t("mediaTagEditor.createTag", { name: TAG_NAME }));
		await expect
			.element(options.nth(1).getByText(JAPANESE_NAME, { exact: true }))
			.toBeVisible();

		await options.nth(index).click();
		await expect.element(input).toHaveValue("");
		await dialog.getByRole("button", { name: t("actions.save") }).click();
		expect(onSave).toHaveBeenCalledExactlyOnceWith({
			expected: [],
			entries: [{ name: TAG_NAME, fromDictionary }],
		});
		await expect.element(dialog).not.toBeInTheDocument();
	},
);

test("retries a dictionary page while retaining focus and deduplicating options", async ({
	onTestFinished,
}) => {
	const nextEntry = {
		...DICTIONARY_ENTRY,
		name: "wavy_hair_ornament",
		japanese: null,
	};
	const dictionarySearch = vi
		.fn<TagDictionaryLookup["dictionarySearch"]>()
		.mockResolvedValueOnce({ items: [DICTIONARY_ENTRY], hasMore: true })
		.mockRejectedValueOnce(new Error("Dictionary temporarily unavailable"))
		.mockResolvedValueOnce({
			items: [DICTIONARY_ENTRY, nextEntry],
			hasMore: false,
		});
	const { dialog, input, options } = await openTagEditor(onTestFinished, {
		...DICTIONARY,
		dictionarySearch,
	});
	const loadMore = dialog.getByRole("button", { name: t("actions.loadMore") });
	const retry = dialog.getByRole("button", { name: t("actions.retry") });
	const error = dialog.getByText(t("tagDictionary.searchError"), {
		exact: true,
	});
	await input.fill(TAG_NAME);
	await expect.element(options).toHaveLength(2);
	await loadMore.click();
	await expect.element(error).toBeVisible();
	await expect.element(options).toHaveLength(2);
	await expect.element(input).toHaveFocus();
	await expect.element(input).toHaveValue(TAG_NAME);

	await retry.click();
	await expect.element(options).toHaveLength(3);
	await expect
		.element(options.getByText(nextEntry.name, { exact: true }))
		.toBeVisible();
	await expect.element(input).toHaveFocus();
	await expect.element(error).not.toBeInTheDocument();
	expect(dictionarySearch.mock.calls.map(([input]) => input)).toEqual([
		{ query: TAG_NAME, offset: 0 },
		{ query: TAG_NAME, offset: TAG_DICTIONARY_PAGE_SIZE },
		{ query: TAG_NAME, offset: TAG_DICTIONARY_PAGE_SIZE },
	]);
});
