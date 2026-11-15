import { Button } from "./button";
import { t } from "@solid-imager/i18n";
import type { JSX, ParentProps } from "solid-js";
import { Show } from "solid-js";
import { Badge, type BadgeProps } from "./badge";
import { ClipboardCopy } from "./clipboard-copy";

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

export function MediaTagBadge(
	props: Pick<BadgeProps, "variant" | "classList" | "title"> & {
		name: string;
		copyLabel?: string;
		onSearch?: () => void;
		searchLabel?: string;
	},
) {
	return (
		<Badge
			class="max-w-full break-all"
			variant={props.variant}
			classList={props.classList}
			title={props.title}
		>
			<Show when={props.onSearch} fallback={props.name}>
				<Button
					type="button"
					variant="link"
					class="h-auto min-w-0 whitespace-normal break-all p-0 text-left text-inherit font-semibold text-xs"
					title={props.searchLabel}
					onClick={() => props.onSearch?.()}
				>
					{props.name}
				</Button>
			</Show>
			<ClipboardCopy
				class="ml-1.5 shrink-0 p-0.5"
				iconSize={12}
				text={props.name}
				label={props.copyLabel}
			/>
		</Badge>
	);
}
