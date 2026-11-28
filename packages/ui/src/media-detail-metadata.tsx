import { Button } from "./button";
import { t } from "@solid-imager/i18n";
import { useQuery } from "@tanstack/solid-query";
import type { ParentProps } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Show, Loading } from "solid-js";
import { Badge, type BadgeProps } from "./badge";
import { ClipboardCopy } from "./clipboard-copy";
import {
	plainTagWikiText,
	tagDictionaryDetailQuery,
	type TagDictionaryLookup,
} from "./tag-dictionary-browser";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export function MediaMetadataSection(
	props: ParentProps<{ title: string; action?: JSX.Element }>,
) {
	return (
		<div class="space-y-2">
			<div class="flex items-center justify-between gap-2">
				<h2 class="font-semibold text-sm">{props.title}</h2>
				{props.action}
			</div>
			{props.children}
		</div>
	);
}

export function MediaAuthorsSection(props: ParentProps) {
	return (
		<MediaMetadataSection title={t("labels.authors")}>
			<ul class="space-y-1">{props.children}</ul>
		</MediaMetadataSection>
	);
}

export function MediaAuthorRow(
	props: ParentProps<{ name: JSX.Element; accountId?: string | null }>,
) {
	return (
		<li>
			<div class="flex min-w-0 items-center gap-2">
				<span class="break-words font-medium">{props.name}</span>
				<Show when={props.accountId}>
					<span class="break-all text-muted-foreground text-xs">
						({props.accountId})
					</span>
				</Show>
			</div>
			{props.children}
		</li>
	);
}

type WikiLookup = TagDictionaryLookup["dictionaryDetail"];
// The focusable badge groups its tag label with the independent copy control.
const WIKI_TRIGGER_PROPS = { role: "group", tabIndex: 0 } as const;

function MediaTagWikiPreview(props: {
	name: string;
	lookup: WikiLookup;
	source?: string;
}) {
	const detail = useQuery(() => ({
		...tagDictionaryDetailQuery(props.lookup, props.name),
		retry: false,
	}));
	const excerpt = () => {
		const body = readQueryData(detail)?.body;
		if (!body) return null;
		return (
			plainTagWikiText(body)
				.split(/\n\s*\n/u)
				.map((part) => part.trim())
				.find(Boolean) ?? null
		);
	};
	return (
		<div class="space-y-1 break-words">
			<p class="font-semibold">
				{readQueryData(detail)?.japanese ?? props.name}
			</p>
			<Show when={detail.isError}>
				<p class="text-muted-foreground">{t("tagDictionary.detailError")}</p>
			</Show>
			<Show when={!detail.isError}>
				<p class="line-clamp-5">
					{excerpt() ??
						t(
							detail.isFetching
								? "status.loading"
								: "tagDictionary.noDescription",
						)}
				</p>
			</Show>
			<Show when={props.source}>
				<p class="text-muted-foreground text-xs">{props.source}</p>
			</Show>
		</div>
	);
}

export function MediaTagBadge(
	props: Pick<BadgeProps, "variant" | "class" | "title"> & {
		name: string;
		copyLabel?: string;
		onSearch?: () => void;
		searchLabel?: string;
		wikiLookup?: WikiLookup;
	},
) {
	const badgeProps = () => ({
		class: [
			"max-w-full break-all",
			props.class,
			{ "cursor-help": !!props.wikiLookup },
		],
		variant: props.variant,
	});
	const searchLabel = () =>
		props.searchLabel ??
		t("mediaSidebar.searchTagValue", { value0: props.name });
	const contents = () => (
		<>
			<Show when={props.onSearch} fallback={props.name}>
				<Button
					aria-label={searchLabel()}
					type="button"
					variant="link"
					class="h-auto min-w-0 whitespace-normal wrap-anywhere p-0 text-left font-semibold text-inherit text-xs focus-visible:ring-2 focus-visible:ring-ring"
					title={searchLabel()}
					onClick={() => props.onSearch?.()}
				>
					{props.name}
				</Button>
			</Show>
			<ClipboardCopy
				compact
				class="ml-1.5 shrink-0 p-0.5"
				iconSize={12}
				text={props.name}
				label={props.copyLabel}
			/>
		</>
	);
	return (
		<Show
			when={props.wikiLookup}
			fallback={
				<Badge {...badgeProps()} title={props.title || undefined}>
					{contents()}
				</Badge>
			}
		>
			{(lookup) => (
				<Tooltip openDelay={350} placement="top">
					<TooltipTrigger
						as={Badge}
						{...badgeProps()}
						{...WIKI_TRIGGER_PROPS}
						aria-label={props.name}
					>
						{contents()}
					</TooltipTrigger>
					<TooltipContent class="w-popover-small px-3 py-2">
						{/* Keep the media inspector mounted while the Wiki request resolves. */}
						<Loading fallback={<p>{t("status.loading")}</p>}>
							<MediaTagWikiPreview
								name={props.name}
								lookup={lookup()}
								source={
									typeof props.title === "string" ? props.title : undefined
								}
							/>
						</Loading>
					</TooltipContent>
				</Tooltip>
			)}
		</Show>
	);
}

import { readQueryData } from "./query-state";
