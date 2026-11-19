import { t } from "@solid-imager/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { MediaTagEditor } from "../media-tag-editor";
import type { TagDictionaryLookup } from "../tag-dictionary-browser";
import { renderComponent } from "./render-component";

const TAG_NAME = "wavy_hair";
const JAPANESE_NAME = "ウェーブヘア";
const DICTIONARY: TagDictionaryLookup = {
	dictionarySearch: async ({ query }) => ({
		items:
			query === TAG_NAME
				? [
						{
							name: TAG_NAME,
							category: 0,
							postCount: 1,
							japanese: JAPANESE_NAME,
							aliases: [],
							wikiNames: [],
							attributes: [],
						},
					]
				: [],
		hasMore: false,
	}),
	dictionaryDetail: async () => null,
};

test.for([
	{ option: "create", index: 0, fromDictionary: false },
	{ option: "dictionary match", index: 1, fromDictionary: true },
])(
	"saves the $option choice for an exact match",
	async ({ index, fromDictionary }, { onTestFinished }) => {
		await page.viewport(390, 844);
		const queryClient = new QueryClient();
		const onSave = vi.fn(async () => {});
		const [open, setOpen] = createSignal(false);
		const dispose = renderComponent(() => (
			<QueryClientProvider client={queryClient}>
				<MediaTagEditor
					tags={[]}
					dictionary={DICTIONARY}
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
		const dialog = page.getByRole("dialog", {
			name: t("mediaTagEditor.title"),
		});
		const input = dialog.getByRole("combobox", {
			name: t("mediaTagEditor.tagNames"),
		});
		await input.fill(TAG_NAME);
		const options = dialog.getByRole("listbox").getByRole("option");
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
