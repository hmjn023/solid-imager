import { t } from "@solid-imager/i18n";
import { For, type JSX, type ParentProps } from "solid-js";
import { Button } from "./button";
import { ArrowLeft, ChevronLeft, ChevronRight } from "./workspace/icons";

export function MediaDetailLayout(props: {
	header?: JSX.Element;
	viewer: JSX.Element;
	related?: JSX.Element;
	sidebar: JSX.Element;
}) {
	return (
		<div class="flex min-h-0 flex-1 flex-col">
			{props.header}
			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-detail-sidebar lg:overflow-hidden scrollbar-stable">
				<div class="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain scrollbar-stable">
					<div class="lg:h-full">{props.viewer}</div>
					{props.related}
				</div>
				<div class="min-w-0 border-border border-t lg:min-h-0 lg:border-t-0 lg:border-l">
					{props.sidebar}
				</div>
			</div>
		</div>
	);
}

export function MediaDetailToolbar(props: {
	title: string;
	sourceName: string;
	onBack: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
	previousLabel?: string;
	nextLabel?: string;
	actions?: JSX.Element;
}) {
	return (
		<header class="z-10 shrink-0 border-border border-b bg-background px-3 py-2 sm:px-4">
			<div class="flex min-w-0 flex-wrap items-center gap-2">
				<Button
					aria-label={t("mediaDetailLayout.backToList")}
					class="size-11 shrink-0 p-0 md:size-9"
					onClick={() => props.onBack()}
					size="icon"
					variant="ghost"
				>
					<ArrowLeft aria-hidden="true" size={17} />
				</Button>
				<div class="min-w-0 flex-1">
					<h1
						class="truncate font-semibold text-sm text-foreground"
						title={props.title}
					>
						{props.title}
					</h1>
					<p class="truncate text-label-sm text-muted-foreground">
						{props.sourceName}
					</p>
				</div>
				<div
					class="flex shrink-0 items-center rounded-md border border-border bg-card p-0.5"
					title={
						props.onPrevious || props.onNext
							? t("mediaDetailLayout.navigateToPreviousOrNextMediaInTheList")
							: t(
									"mediaDetailLayout.previousAndNextAreUnavailableWithoutListContext",
								)
					}
				>
					<Button
						aria-label={
							props.previousLabel ?? t("mediaDetailLayout.previousMedia")
						}
						class="size-11 p-0 md:size-8"
						disabled={!props.onPrevious}
						onClick={() => props.onPrevious?.()}
						size="icon"
						variant="ghost"
					>
						<ChevronLeft aria-hidden="true" size={16} />
					</Button>
					<Button
						aria-label={props.nextLabel ?? t("mediaDetailLayout.nextMedia")}
						class="size-11 p-0 md:size-8"
						disabled={!props.onNext}
						onClick={() => props.onNext?.()}
						size="icon"
						variant="ghost"
					>
						<ChevronRight aria-hidden="true" size={16} />
					</Button>
				</div>
				<div class="order-last w-full empty:hidden md:order-none md:w-auto">
					{props.actions}
				</div>
			</div>
		</header>
	);
}

export function MediaDetailInspector(props: ParentProps<{ label?: string }>) {
	return (
		<aside
			aria-label={props.label}
			class="min-w-0 divide-y divide-border bg-background px-4 pb-6 text-foreground lg:h-full lg:overflow-y-auto lg:overscroll-contain [&>div]:py-4 scrollbar-stable"
		>
			{props.children}
		</aside>
	);
}

export function formatBytes(bytes: number, decimals = 2) {
	if (bytes === 0) {
		return "0 Bytes";
	}
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function MediaFileInformation(props: {
	title: string;
	rows: Array<[label: string, value: JSX.Element]>;
}) {
	return (
		<div class="space-y-2">
			<h2 class="font-semibold text-sm">{props.title}</h2>
			<dl class="grid grid-cols-label-field gap-x-4 gap-y-2 text-sm">
				<For each={props.rows}>
					{([label, value]) => (
						<>
							<dt class="font-medium text-muted-foreground">{label}</dt>
							<dd class="min-w-0 break-words text-right text-foreground">
								{value}
							</dd>
						</>
					)}
				</For>
			</dl>
		</div>
	);
}
