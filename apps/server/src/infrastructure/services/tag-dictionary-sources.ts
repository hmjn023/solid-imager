import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import {
	canonicalTagName,
	normalizeTagDictionaryQuery,
	tagDictionaryCategorySchema,
	type TagDictionaryAttributesRow,
	type TagDictionaryTagRow,
	type TagDictionaryWikiRow,
} from "@solid-imager/core/tags";
import { z } from "zod";

const TAGS_URL =
	"https://raw.githubusercontent.com/PYU224/tagdb-updater/main/dist/";
const WIKI_URL =
	"https://huggingface.co/datasets/patvessel/danbooru-wiki-2606/resolve/f106167/danbooru-wiki-2606.jsonl";
const ATTRIBUTES_URL =
	"https://huggingface.co/datasets/StoryAura/Danbooru-Dataset-csv/resolve/main/danbooru_dataset_general_260820.csv";
export const WIKI_VERSION = "2026-06-01";
export const ATTRIBUTES_VERSION = "2026-08-20";
const BATCH_SIZE = 1000;

const tagsMetadataSchema = z.object({
	generated_at: z.iso.datetime(),
	tag_count_total: z.number().int().positive().max(1_000_000),
});
const tagsSchema = z.array(
	z.object({
		t: z.string().trim().min(1),
		c: tagDictionaryCategorySchema,
		cnt: z.number().int().nonnegative().max(2_147_483_647),
		ja: z.string().optional(),
		a: z.array(z.string()).optional(),
	}),
);
const wikiSchema = z.object({
	title: z.string().trim().min(1),
	body: z.string(),
	other_names: z.array(z.string()),
	is_deleted: z.boolean(),
	updated_at: z.iso.datetime({ offset: true }),
});

async function download(url: string, timeout = 30_000) {
	const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
	if (!response.ok || !response.body) {
		throw new Error(`Download returned HTTP ${response.status}`);
	}
	return response;
}

export async function fetchTagDictionaryVersion() {
	const response = await download(`${TAGS_URL}meta.json`);
	const data = tagsMetadataSchema.parse(await response.json());
	return { version: data.generated_at, count: data.tag_count_total };
}

const searchText = (terms: string[]) =>
	terms.map(normalizeTagDictionaryQuery).filter(Boolean).join("\n");

export async function fetchDictionaryTags(expectedCount: number) {
	const response = await download(`${TAGS_URL}tags.json`);
	const tags = tagsSchema.parse(await response.json());
	if (tags.length !== expectedCount)
		throw new Error("Tag snapshot count does not match metadata");
	return tagBatches(tags);
}

function* tagBatches(
	tags: z.infer<typeof tagsSchema>,
): Generator<TagDictionaryTagRow[]> {
	type Row = Omit<TagDictionaryTagRow, "searchText">;
	const unique = new Map<string, Row>();
	for (const tag of tags) {
		const name = canonicalTagName(tag.t);
		const previous = unique.get(name);
		const higherCount = !previous || tag.cnt > previous.postCount;
		const japanese = tag.ja?.trim() || null;
		unique.set(name, {
			name,
			category: higherCount ? tag.c : previous.category,
			postCount: higherCount ? tag.cnt : previous.postCount,
			japanese: higherCount
				? (japanese ?? previous?.japanese ?? null)
				: (previous.japanese ?? japanese),
			aliases: [
				...new Set([
					...(previous?.aliases ?? []),
					...(tag.a ?? []).map(canonicalTagName),
				]),
			].filter((alias) => alias && alias !== name),
		});
	}
	let batch: TagDictionaryTagRow[] = [];
	for (const row of unique.values()) {
		batch.push({ ...row, searchText: searchText([row.name, ...row.aliases]) });
		if (batch.length >= BATCH_SIZE) {
			yield batch;
			batch = [];
		}
	}
	if (batch.length) yield batch;
}

export async function withWikiSnapshot<T>(
	consume: (filename: string) => Promise<T>,
): Promise<T> {
	const directory = await mkdtemp(join(tmpdir(), "solid-imager-wiki-"));
	try {
		const filename = join(directory, "wiki.jsonl");
		const response = await download(WIKI_URL, 180_000);
		if (!response.body) throw new Error("Missing Wiki download");
		await pipeline(response.body, createWriteStream(filename));
		return await consume(filename);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

export async function* readDictionaryWiki(
	filename: string,
): AsyncGenerator<TagDictionaryWikiRow[]> {
	const input = createReadStream(filename);
	const lines = createInterface({ input, crlfDelay: Infinity });
	let batch = new Map<string, TagDictionaryWikiRow>();
	let count = 0;
	try {
		for await (const line of lines) {
			const page = wikiSchema.parse(JSON.parse(line));
			count++;
			if (page.is_deleted) continue;
			const name = canonicalTagName(page.title);
			const updatedAt = new Date(page.updated_at).toISOString();
			const previous = batch.get(name);
			if (previous && previous.updatedAt >= updatedAt) continue;
			batch.set(name, {
				name,
				body: page.body.trim() || null,
				otherNames: page.other_names,
				updatedAt,
			});
			if (batch.size >= BATCH_SIZE) {
				yield [...batch.values()];
				batch = new Map();
			}
		}
		if (count !== 266_777) throw new Error("Incomplete Wiki snapshot");
		if (batch.size) yield [...batch.values()];
	} finally {
		lines.close();
		input.destroy();
	}
}

function readAttributeColumns(line: string): string[] {
	const columns: string[] = [];
	let end = 0;
	for (const match of line.matchAll(
		/(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))(?=,|$)/guy,
	)) {
		end = match.index + match[0].length;
		columns.push(match[1]?.replaceAll('""', '"') ?? match[2]);
	}
	if (end !== line.length) throw new Error("Invalid attribute snapshot row");
	return columns;
}

export async function fetchDictionaryAttributes() {
	const response = await download(ATTRIBUTES_URL);
	const csv = (await response.text()).replace(/^\uFEFF/u, "").trimEnd();
	const lines = csv.split(/\r?\n/u);
	const header = lines.shift();
	if (
		header !==
			"tag,category,other_names,copyright,level,parent_tag,post_count,category_l1,category_l2,wiki_url" ||
		lines.length !== 106_414
	) {
		throw new Error("Unexpected attribute snapshot format");
	}
	return lines;
}

export async function* readDictionaryAttributes(
	lines: string[],
): AsyncGenerator<TagDictionaryAttributesRow[]> {
	let batch: TagDictionaryAttributesRow[] = [];
	for (const line of lines) {
		const columns = readAttributeColumns(line);
		if (columns.length !== 10 || !columns[0])
			throw new Error("Invalid attribute snapshot row");
		const values = [...new Set([columns[7], columns[8]].filter(Boolean))];
		if (!values.length) continue;
		batch.push({ name: canonicalTagName(columns[0]), attributes: values });
		if (batch.length >= BATCH_SIZE) {
			yield batch;
			batch = [];
		}
	}
	if (batch.length) yield batch;
}
