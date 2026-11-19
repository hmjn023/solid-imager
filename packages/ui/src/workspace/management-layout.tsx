import { t } from "@solid-imager/i18n";
import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../select";

import { cn } from "../utils/cn";

export const MANAGEMENT_CONTENT_PADDING =
	"px-3 py-4 sm:px-4 lg:px-6 lg:py-5 xl:px-8";
export const MANAGEMENT_CATEGORY_GRID =
	"grid w-full min-w-0 gap-6 lg:grid-cols-settings-sidebar xl:gap-8";
export const MANAGEMENT_CATEGORY_LIST =
	"hidden lg:sticky lg:top-5 lg:self-start";

export function ManagementScreen(props: {
	header: JSX.Element;
	children: JSX.Element;
}) {
	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-background">
			{props.header}
			{props.children}
		</section>
	);
}

export function ManagementScrollArea(
	props: JSX.HTMLAttributes<HTMLDivElement>,
) {
	const [local, rest] = splitProps(props, ["class"]);
	return (
		<div
			{...rest}
			data-management-scroll
			class={cn(
				"min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain scrollbar-stable",
				local.class,
			)}
		/>
	);
}

export function ManagementMobileCategory(props: { children: JSX.Element }) {
	return (
		<div class="sticky top-0 z-10 min-w-0 self-start border-border border-b bg-background px-3 py-2 lg:hidden">
			{props.children}
		</div>
	);
}

type ManagementHeaderProps = {
	actions?: JSX.Element;
	description: string;
	eyebrow?: string;
	title: string;
};

export function ManagementHeader(props: ManagementHeaderProps) {
	return (
		<header class="shrink-0 border-border border-b bg-card px-4 py-3 sm:px-6">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<p class="font-medium text-xs text-primary">
						{props.eyebrow ?? t("managementLayout.workspace")}
					</p>
					<h1 class="mt-0.5 font-semibold text-xl text-foreground">
						{props.title}
					</h1>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{props.description}
					</p>
				</div>
				<Show when={props.actions}>
					<div class="shrink-0">{props.actions}</div>
				</Show>
			</div>
		</header>
	);
}

export const CATEGORY_TABS_CLASS =
	"min-h-11 shrink-0 gap-2.5 rounded-md px-2.5 text-muted-foreground shadow-none data-[selected]:bg-accent data-[selected]:text-primary lg:min-h-10 lg:w-full lg:justify-start";

export function CompactCategorySelect<
	Category extends { label: string; value: string },
>(props: {
	active: string;
	options: readonly Category[];
	label: string;
	onChange: (value: Category["value"]) => void;
	renderIcon: (category: Category) => JSX.Element;
}) {
	return (
		<Select<Category>
			class="flex items-center gap-3"
			disallowEmptySelection
			options={[...props.options]}
			optionTextValue="label"
			optionValue="value"
			value={props.options.find((category) => category.value === props.active)}
			onChange={(category) => {
				if (category) props.onChange(category.value);
			}}
			itemComponent={(itemProps) => (
				<SelectItem item={itemProps.item}>
					<span class="flex items-center gap-2">
						{props.renderIcon(itemProps.item.rawValue)}
						{itemProps.item.rawValue.label}
					</span>
				</SelectItem>
			)}
		>
			<SelectLabel class="shrink-0 text-muted-foreground">
				{props.label}
			</SelectLabel>
			<SelectTrigger class="min-w-0 gap-2 bg-card text-start">
				<SelectValue<Category>>
					{(state) => state.selectedOption()?.label}
				</SelectValue>
			</SelectTrigger>
			<SelectContent class="lg:hidden" />
		</Select>
	);
}

export function categoryButtonClass(active: boolean): string {
	return `flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${
		active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted"
	}`;
}

export function CategoryLabel(props: {
	description: string;
	icon: JSX.Element;
	label: string;
	responsiveDescription?: "lg" | "md";
}) {
	const descriptionBreakpoint = () =>
		props.responsiveDescription === "md" ? "md:block" : "lg:block";
	return (
		<>
			<span class="shrink-0">{props.icon}</span>
			<span class="min-w-0 text-left">
				<strong class="block truncate font-medium text-sm">
					{props.label}
				</strong>
				<span
					class={`hidden truncate text-label-sm text-muted-foreground ${descriptionBreakpoint()}`}
				>
					{props.description}
				</span>
			</span>
		</>
	);
}
