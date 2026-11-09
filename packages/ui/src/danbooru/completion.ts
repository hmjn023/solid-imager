/** Locate the tag at the caret; preserve exclusion/OR operators and other tokens. */
export function getDanbooruCompletion(draft: string, caret = draft.length) {
	const start = draft.lastIndexOf(" ", Math.max(0, caret - 1)) + 1;
	const nextSpace = draft.indexOf(" ", caret);
	const end = nextSpace < 0 ? draft.length : nextSpace;
	const token = draft.slice(start, end);
	const prefix = /^[~-]/.test(token) ? token[0] : "";
	const query = draft.slice(start + prefix.length, caret);
	return { start, end, prefix, query: query.includes(":") ? "" : query };
}

export function completeDanbooruTag(
	draft: string,
	caret: number,
	name: string,
) {
	const token = getDanbooruCompletion(draft, caret);
	return `${draft.slice(0, token.start)}${token.prefix}${name} ${draft.slice(token.end).trimStart()}`;
}

export const danbooruTagCategoryLabels: Record<number, string> = {
	0: "タグ",
	1: "作者",
	3: "作品",
	4: "キャラクター",
	5: "メタ",
};
