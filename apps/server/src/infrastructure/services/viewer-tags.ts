import { ORPCError } from "@orpc/server";
import type { TagMapping, ViewerTag } from "@solid-imager/core/external-viewer";
import { z } from "zod";
import { danbooruService } from "./danbooru-service";

// This public snapshot contains Wiki other_names, rather than machine-translated display names.
const snapshotUrl =
	"https://github.com/Jannchie/danbooru-tag-index/releases/download/data-latest/wiki_other_names.json";
let cachedSnapshot: Record<string, string[]> = {};
let refreshAfter = 0;
let refreshing: Promise<void> | undefined;
async function snapshot() {
	if (Date.now() >= refreshAfter && !refreshing) {
		refreshing = (async () => {
			try {
				const response = await fetch(snapshotUrl, {
					signal: AbortSignal.timeout(8000),
				});
				if (!response.ok) throw new Error("Unavailable tag snapshot");
				cachedSnapshot = z
					.record(z.string(), z.array(z.string()))
					.parse(await response.json());
				refreshAfter = Date.now() + 86_400_000;
			} catch {
				refreshAfter = Date.now() + 60_000;
			} finally {
				refreshing = undefined;
			}
		})();
	}
	await refreshing;
	return cachedSnapshot;
}
const invalidQuery = (message: string) =>
	new ORPCError("BAD_REQUEST", { message });
const hasJapanese = (name: string) =>
	/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(name);
function isSingleTerm(name: string) {
	return (
		!!name &&
		name.length <= 200 &&
		!/\s/u.test(name) &&
		!/^[-~(]/.test(name) &&
		name.toUpperCase() !== "OR"
	);
}
export async function lookupTag(tag: string) {
	if (hasJapanese(tag)) return { names: [], source: "literal" as const };
	try {
		const names = await danbooruService.wikiNames(tag);
		if (names.length) return { names, source: "wiki" as const };
	} catch {
		/* Fall back to the same Wiki field in the public snapshot. */
	}
	const index = await snapshot();
	const names = Object.hasOwn(index, tag) ? index[tag] : [];
	return {
		names,
		source: names.length ? ("snapshot" as const) : ("literal" as const),
	};
}
/** Offer the canonical tag when the user types either its name or a Wiki spelling. */
export function matchSnapshotTags(
	index: Record<string, string[]>,
	query: string,
): ViewerTag[] {
	const prefix = query.toLowerCase(),
		exact: string[] = [],
		partial: string[] = [];
	const includeAliases = hasJapanese(query);
	for (const [name, aliases] of Object.entries(index)) {
		if (name === prefix || (includeAliases && aliases.includes(query)))
			exact.push(name);
		else if (
			partial.length < 12 &&
			(name.startsWith(prefix) ||
				(includeAliases && aliases.some((alias) => alias.startsWith(query))))
		)
			partial.push(name);
		if (exact.length === 12) break;
	}
	return [...exact, ...partial]
		.slice(0, 12)
		.map((name) => ({ name, category: null, postCount: null }));
}
export async function suggestViewerTags(query: string): Promise<ViewerTag[]> {
	try {
		return hasJapanese(query)
			? await danbooruService.suggestWikiTitles(query)
			: await danbooruService.suggestTags(query);
	} catch (error) {
		const index = await snapshot();
		if (!Object.keys(index).length) throw error;
		return matchSnapshotTags(index, query);
	}
}

/** Translate the canonical query once; keep include, exclude and OR groups distinct. */
export async function resolvePixivQuery(
	tags: string,
	choices: Record<string, string> = {},
	lookup = lookupTag,
) {
	const tokens = tags.trim().split(/\s+/).filter(Boolean);
	if (tokens.length > 24)
		throw invalidQuery("pixiv の検索条件は24個まで指定できます。");
	const terms = tokens.map((token) => {
		const prefix = /^[-~]/.test(token) ? token[0] : "";
		const tag = token.slice(prefix.length);
		if (tag.includes(":") || tag.includes("*") || !isSingleTerm(tag))
			throw invalidQuery(
				"pixiv ではこの条件を使用できません: " +
					token +
					"。タグ、-タグ、~タグが使えます。",
			);
		return { tag, prefix };
	});
	const mappings: TagMapping[] = await Promise.all(
		[...new Set(terms.map((term) => term.tag))].map(async (tag) => {
			const { names, source } = await lookup(tag);
			const candidates = [
				...new Set([
					...names.filter((name) => isSingleTerm(name) && hasJapanese(name)),
					tag,
					...names.filter(isSingleTerm),
				]),
			];
			const selected =
				Object.hasOwn(choices, tag) && candidates.includes(choices[tag])
					? choices[tag]
					: candidates[0];
			return { tag, names: candidates, selected, source };
		}),
	);
	const translated = new Map(mappings.map((row) => [row.tag, row.selected]));
	const and: string[] = [],
		or: string[] = [];
	for (const term of terms) {
		const word = translated.get(term.tag) ?? term.tag;
		if (term.prefix === "~") or.push(word);
		else and.push(term.prefix + word);
	}
	if (or.length)
		and.push(or.length === 1 ? or[0] : "(" + or.join(" OR ") + ")");
	return { word: and.join(" "), mappings };
}
