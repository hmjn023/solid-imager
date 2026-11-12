import { t } from "@solid-imager/i18n";
/** Locate the tag at the caret; preserve exclusion/OR operators and other tokens. */
export function getDanbooruCompletion(draft: string, caret = draft.length) {
	const beforeCaret = draft.slice(0, caret);
	const active = beforeCaret.match(/\S*$/)?.[0] ?? "";
	const start = beforeCaret.length - active.length;
	const afterCaret = draft.slice(caret).match(/^\S*/)?.[0] ?? "";
	const end = beforeCaret.length + afterCaret.length;
	const prefix = /^[~-]/.test(active) ? active[0] : "";
	const query = active.slice(prefix.length);
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
	0: t("pixivArtworkDetail.tags"),
	1: t("labels.authors"),
	3: t("detail.work"),
	4: t("labels.characters"),
	5: t("danbooruPostDetail.metadata"),
};
