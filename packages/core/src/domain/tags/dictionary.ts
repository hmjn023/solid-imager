import { z } from "zod";
import { jobStatusSchema } from "../jobs/schemas";

export {
	TAG_DICTIONARY_JOB,
	tagDictionaryJobPayloadSchema,
} from "./dictionary-job";
export const TAG_DICTIONARY_PAGE_SIZE = 30;
export const tagDictionaryCategorySchema = z.union([
	z.literal(0),
	z.literal(1),
	z.literal(3),
	z.literal(4),
	z.literal(5),
]);
export const tagDictionarySourceSchema = z.enum(["tags", "wiki", "attributes"]);
export type TagDictionarySource = z.infer<typeof tagDictionarySourceSchema>;

export const tagDictionaryEntrySchema = z.object({
	name: z.string(),
	category: tagDictionaryCategorySchema,
	postCount: z.number().int().nonnegative(),
	japanese: z.string().nullable(),
	aliases: z.array(z.string()),
	wikiNames: z.array(z.string()),
	attributes: z.array(z.string()),
});
export const tagDictionaryDetailSchema = tagDictionaryEntrySchema.extend({
	body: z.string().nullable(),
	wikiUpdatedAt: z.iso.datetime().nullable(),
	wikiSource: z.enum(["snapshot", "danbooru"]).nullable(),
});
export const tagDictionarySearchSchema = z.object({
	query: z.string().trim().max(200).default(""),
	category: tagDictionaryCategorySchema.optional(),
	offset: z.number().int().min(0).max(1_000_000).default(0),
});
export const tagDictionarySearchResultSchema = z.object({
	items: z.array(tagDictionaryEntrySchema),
	hasMore: z.boolean(),
});
export const tagDictionaryLegacySearchSchema = tagDictionarySearchSchema.omit({
	category: true,
});
export const tagDictionaryLegacyResultSchema = z.object({
	items: z.array(z.object({ id: z.uuid(), name: z.string() })),
	hasMore: z.boolean(),
});
export const tagDictionaryMigrationSchema = z.object({
	tagId: z.uuid(),
	sourceName: z.string().min(1),
	target: z.string().trim().min(1).max(200),
});
export const tagDictionarySnapshotSchema = z.object({
	source: tagDictionarySourceSchema,
	version: z.string(),
	count: z.number().int().nonnegative(),
	installedAt: z.iso.datetime(),
});
export const tagDictionaryStatusSchema = z.object({
	snapshots: z.array(tagDictionarySnapshotSchema),
	job: z
		.object({
			id: z.uuid(),
			status: jobStatusSchema,
			updatedAt: z.iso.datetime(),
			error: z.string().nullable(),
		})
		.nullable(),
});

export type TagDictionaryEntry = z.infer<typeof tagDictionaryEntrySchema>;
export type TagDictionaryDetail = z.infer<typeof tagDictionaryDetailSchema>;
export type TagDictionarySearch = z.input<typeof tagDictionarySearchSchema>;
export type TagDictionarySearchResult = z.infer<
	typeof tagDictionarySearchResultSchema
>;
export type TagDictionaryStatus = z.infer<typeof tagDictionaryStatusSchema>;
export type TagDictionaryLegacySearch = z.input<
	typeof tagDictionaryLegacySearchSchema
>;
export type TagDictionaryLegacyResult = z.infer<
	typeof tagDictionaryLegacyResultSchema
>;
export type TagDictionaryMigration = z.infer<
	typeof tagDictionaryMigrationSchema
>;
type TagDictionaryAttempt = { id: string; number: number };

/** Danbooru uses underscores while some datasets export spaces. */
export function canonicalTagName(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/gu, "_");
}

export function normalizeTagDictionaryQuery(text: string): string {
	return text
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[_\s]+/gu, " ")
		.trim();
}

export type TagDictionaryTagRow = Pick<
	TagDictionaryEntry,
	"name" | "category" | "postCount" | "japanese" | "aliases"
> & { searchText: string };
export type TagDictionaryWikiRow = {
	name: string;
	body: string | null;
	otherNames: string[];
	updatedAt: string;
};
export type TagDictionaryAttributesRow = Pick<
	TagDictionaryEntry,
	"name" | "attributes"
>;
export type TagDictionaryImport =
	| { source: "tags"; rows: Iterable<TagDictionaryTagRow[]> }
	| { source: "wiki"; rows: AsyncIterable<TagDictionaryWikiRow[]> }
	| { source: "attributes"; rows: AsyncIterable<TagDictionaryAttributesRow[]> };

export type TagDictionaryRepository = {
	status: () => Promise<TagDictionaryStatus>;
	queueRefresh: (
		options:
			| { trigger: "manual" }
			| { trigger: "automatic"; completedBefore: Date; retryBefore: Date },
	) => Promise<string | null>;
	search: (
		input: z.output<typeof tagDictionarySearchSchema>,
	) => Promise<TagDictionarySearchResult>;
	detail: (name: string) => Promise<TagDictionaryDetail | null>;
	matchNames: (
		names: readonly string[],
	) => Promise<ReadonlyMap<string, string>>;
	listLegacy: (
		input: z.output<typeof tagDictionaryLegacySearchSchema>,
	) => Promise<TagDictionaryLegacyResult>;
	migrateLegacy: (input: TagDictionaryMigration) => Promise<boolean>;
	reconcileLegacy: (attempt: TagDictionaryAttempt) => Promise<void>;
	replace: (
		data: TagDictionaryImport,
		version: string,
		attempt: TagDictionaryAttempt,
	) => Promise<number>;
};
