import { AppConfigSchema } from "@solid-imager/core/config";
import type { TagDictionaryDetail } from "@solid-imager/core/tags";
import { beforeEach, expect, it, vi } from "vitest";
import { getTagDictionaryDetail } from "~/infrastructure/services/tag-dictionary-service";

const { detail, getConfig, wikiPage } = vi.hoisted(() => ({
	detail: vi.fn<(name: string) => Promise<TagDictionaryDetail | null>>(),
	getConfig: vi.fn(),
	wikiPage: vi.fn(),
}));

vi.mock("~/infrastructure/db/repositories", () => ({
	TagDictionaryRepository: { detail },
}));
vi.mock("~/infrastructure/service-registry", () => ({
	services: { getConfigService: () => ({ getConfig }) },
}));
vi.mock("~/infrastructure/services/danbooru-service", () => ({
	danbooruService: { wikiPage },
}));

const entry: TagDictionaryDetail = {
	name: "wavy_hair",
	category: 0,
	postCount: 1,
	japanese: null,
	aliases: [],
	wikiNames: [],
	attributes: [],
	body: null,
	wikiUpdatedAt: null,
	wikiSource: null,
};

beforeEach(() => {
	vi.resetAllMocks();
	getConfig.mockReturnValue(AppConfigSchema.parse({}));
	detail.mockResolvedValue(entry);
});

it("uses only the dataset by default and after the option is turned off", async () => {
	expect(await getTagDictionaryDetail("wavy hair")).toEqual(entry);
	expect(wikiPage).not.toHaveBeenCalled();

	getConfig.mockReturnValue(
		AppConfigSchema.parse({ tagDictionary: { fetchMissingWiki: true } }),
	);
	wikiPage.mockResolvedValue({
		body: "Hair that falls in waves.",
		other_names: ["ウェーブヘア"],
		updated_at: "2026-06-01T09:00:00+09:00",
	});
	expect(await getTagDictionaryDetail("waved_hair")).toEqual({
		...entry,
		body: "Hair that falls in waves.",
		wikiNames: ["ウェーブヘア"],
		wikiUpdatedAt: "2026-06-01T00:00:00.000Z",
		wikiSource: "danbooru",
	});
	expect(detail).toHaveBeenCalledWith("waved_hair");
	expect(wikiPage).toHaveBeenCalledWith("wavy_hair");

	getConfig.mockReturnValue(
		AppConfigSchema.parse({ tagDictionary: { fetchMissingWiki: false } }),
	);
	expect(await getTagDictionaryDetail("wavy hair")).toEqual(entry);
	expect(wikiPage).toHaveBeenCalledTimes(1);
});

it("skips Danbooru when a description is present or the tag is outside the dictionary", async () => {
	getConfig.mockReturnValue(
		AppConfigSchema.parse({ tagDictionary: { fetchMissingWiki: true } }),
	);
	const local = { ...entry, body: "Stored description" };
	detail.mockResolvedValueOnce(local).mockResolvedValueOnce(null);
	expect(await getTagDictionaryDetail(entry.name)).toEqual(local);
	expect(await getTagDictionaryDetail("unregistered")).toBeNull();
	expect(wikiPage).not.toHaveBeenCalled();
});
