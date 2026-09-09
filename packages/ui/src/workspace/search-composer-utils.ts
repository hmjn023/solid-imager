import { mediaIdSchema } from "@solid-imager/core/domain/media/schemas";
import type { SearchState } from "@solid-imager/core/domain/search/schema";
import type { SearchPageFilterData } from "../hooks/use-search-page";

export type SearchArrayKey =
	| "excludeTags"
	| "selectedAuthors"
	| "selectedCharacters"
	| "selectedIps"
	| "selectedProjects"
	| "selectedTags";

export type SearchToken = {
	destructive?: boolean;
	key:
		| SearchArrayKey
		| "searchQuery"
		| "similarityAnchorMediaId"
		| "similarityTopK";
	prefix: string;
	value: string;
	removable?: boolean;
};

export type SearchSuggestion = {
	key: SearchArrayKey;
	label: string;
	prefix: string;
	value: string;
};

export function getSearchComposerTokens(state: SearchState): SearchToken[] {
	const similarityTokens: SearchToken[] = state.similarityAnchorMediaId
		? [
				{
					key: "similarityAnchorMediaId",
					prefix: "similar",
					value: state.similarityAnchorMediaId,
				},
				{
					key: "similarityTopK",
					prefix: "limit",
					value: String(state.similarityTopK),
					removable: false,
				},
			]
		: [];
	const normalTokens: SearchToken[] = [
		...(state.searchQuery
			? [
					{
						key: "searchQuery" as const,
						prefix: "name",
						value: state.searchQuery,
					},
				]
			: []),
		...state.selectedTags.map((value) => ({
			key: "selectedTags" as const,
			prefix: "tag",
			value,
		})),
		...state.excludeTags.map((value) => ({
			destructive: true,
			key: "excludeTags" as const,
			prefix: "-tag",
			value,
		})),
		...state.selectedCharacters.map((value) => ({
			key: "selectedCharacters" as const,
			prefix: "character",
			value,
		})),
		...state.selectedIps.map((value) => ({
			key: "selectedIps" as const,
			prefix: "ip",
			value,
		})),
		...state.selectedAuthors.map((value) => ({
			key: "selectedAuthors" as const,
			prefix: "author",
			value,
		})),
		...state.selectedProjects.map((value) => ({
			key: "selectedProjects" as const,
			prefix: "project",
			value,
		})),
	];
	return [...similarityTokens, ...normalTokens];
}

export function parseSimilarityTopK(value: string): number | undefined {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100
		? parsed
		: undefined;
}

export function parseSimilarityAnchor(value: string): string | undefined {
	const parsed = mediaIdSchema.safeParse(value);
	return parsed.success ? parsed.data : undefined;
}

type SuggestionSource = keyof SearchPageFilterData;

type SuggestionConfig = {
	key: SearchArrayKey;
	prefix: string;
	source: SuggestionSource;
};

const SUGGESTION_CONFIGS: Record<string, SuggestionConfig> = {
	author: { key: "selectedAuthors", prefix: "author", source: "authors" },
	character: {
		key: "selectedCharacters",
		prefix: "character",
		source: "characters",
	},
	"-tag": { key: "excludeTags", prefix: "-tag", source: "tags" },
	ip: { key: "selectedIps", prefix: "ip", source: "ips" },
	project: { key: "selectedProjects", prefix: "project", source: "projects" },
	tag: { key: "selectedTags", prefix: "tag", source: "tags" },
};

type ActiveToken = {
	config: SuggestionConfig;
	query: string;
};

function getActiveToken(value: string): ActiveToken | undefined {
	const match = value.match(/(?:^|\s)([^\s]*)$/);
	if (!match) return undefined;

	const rawToken = match[1];
	const separatorIndex = rawToken.indexOf(":");
	if (separatorIndex < 1) return undefined;

	const config =
		SUGGESTION_CONFIGS[rawToken.slice(0, separatorIndex).toLowerCase()];
	if (!config) return undefined;

	const rawValue = rawToken.slice(separatorIndex + 1);
	if (rawValue.includes(",")) return undefined;

	return {
		config,
		query: rawValue.replace(/^"|"$/g, ""),
	};
}

export function removeActiveSearchToken(value: string): string {
	const match = value.match(/(?:^|\s)([^\s]*)$/);
	if (!match) return value;
	const tokenStart = (match.index ?? 0) + match[0].length - match[1].length;
	const remaining = value.slice(0, tokenStart).trimEnd();
	return remaining.length > 0 ? `${remaining} ` : "";
}

function getSourceValues(
	filterData: SearchPageFilterData,
	source: SuggestionSource,
): Array<{ label: string; value: string }> {
	switch (source) {
		case "authors":
			return (filterData.authors ?? []).map((author) => ({
				label: author.accountId
					? `${author.name}：${author.accountId}`
					: author.name,
				value: author.name,
			}));
		case "characters":
			return (filterData.characters ?? []).map((character) => ({
				label: character.name,
				value: character.name,
			}));
		case "ips":
			return (filterData.ips ?? []).map((ip) => ({
				label: ip.name,
				value: ip.name,
			}));
		case "projects":
			return (filterData.projects ?? []).map((project) => ({
				label: project.name,
				value: project.name,
			}));
		case "tags":
			return (filterData.tags ?? []).map((tag) => ({
				label: tag.name,
				value: tag.name,
			}));
	}
}

export function getSearchComposerSuggestions(
	draft: string,
	filterData: SearchPageFilterData,
	tokens: SearchToken[],
): SearchSuggestion[] {
	const active = getActiveToken(draft);
	if (!active) return [];

	const selectedValues = new Set(
		tokens
			.filter((token) => token.key === active.config.key)
			.map((token) => token.value),
	);
	const query = active.query.toLowerCase();
	const seen = new Set<string>();

	return getSourceValues(filterData, active.config.source)
		.filter(({ value }) => {
			const normalized = value.toLowerCase();
			if (selectedValues.has(value) || seen.has(value)) return false;
			if (!normalized.includes(query)) return false;
			seen.add(value);
			return true;
		})
		.slice(0, 100)
		.map(({ label, value }) => ({
			key: active.config.key,
			label,
			prefix: active.config.prefix,
			value,
		}));
}
