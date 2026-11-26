import {
	Pagination as PaginationPrimitive,
	PaginationEllipsis as PaginationEllipsisPrimitive,
	PaginationLink,
	PaginationList,
	PaginationNext as PaginationNextPrimitive,
	PaginationPrevious as PaginationPreviousPrimitive,
	type PaginationState,
} from "@ui-sdk/solid/pagination";
import { t } from "@solid-imager/i18n";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext, For, omit, Show, useContext } from "solid-js";

import { buttonVariants } from "./button";
import { cn } from "./utils/cn";

type ClassProps<Props> = Omit<Props, "class" | "children"> & {
	class?: string;
	children?: JSX.Element;
};
type PaginationRootProps = ClassProps<
	ComponentProps<typeof PaginationPrimitive>
> & {
	count?: number;
	itemComponent?: (props: { page: number }) => JSX.Element;
	ellipsisComponent?: () => JSX.Element;
};

const PaginationContext = createContext<{
	props: PaginationRootProps;
	state: PaginationState;
}>();

function Pagination(props: PaginationRootProps) {
	return (
		<PaginationPrimitive
			{...omit(
				props,
				"class",
				"children",
				"count",
				"itemComponent",
				"ellipsisComponent",
			)}
			pageCount={props.pageCount ?? props.count}
			class={cn(
				"[&>*]:flex [&>*]:flex-row [&>*]:items-center [&>*]:gap-1",
				props.class,
			)}
		>
			<PaginationList>
				{(state) => (
					<PaginationContext value={{ props, state }}>
						{props.children}
					</PaginationContext>
				)}
			</PaginationList>
		</PaginationPrimitive>
	);
}

function PaginationItems() {
	const context = useContext(PaginationContext);
	return (
		<For each={context.state.items}>
			{(page) =>
				typeof page === "number"
					? (context.props.itemComponent?.({ page }) ?? (
							<PaginationItem page={page} />
						))
					: (context.props.ellipsisComponent?.() ?? <PaginationEllipsis />)
			}
		</For>
	);
}

type PaginationItemProps = ClassProps<ComponentProps<typeof PaginationLink>>;

const PaginationItem = (props: PaginationItemProps) => {
	const others = omit(props, "class");
	return (
		<li>
			<PaginationLink
				class={cn(
					buttonVariants({
						variant: "ghost",
					}),
					"size-11 data-[current]:border data-[current]:border-primary data-[current]:bg-accent data-[current]:text-accent-foreground sm:size-10",
					props.class,
				)}
				{...others}
			/>
		</li>
	);
};

type PaginationEllipsisProps = ClassProps<
	ComponentProps<typeof PaginationEllipsisPrimitive>
>;

const PaginationEllipsis = (props: PaginationEllipsisProps) => {
	const others = omit(props, "class");
	return (
		<li>
			<PaginationEllipsisPrimitive
				class={cn("flex size-10 items-center justify-center", props.class)}
				{...others}
			>
				<svg
					aria-hidden="true"
					class="size-4"
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<circle cx="12" cy="12" r="1" />
					<circle cx="19" cy="12" r="1" />
					<circle cx="5" cy="12" r="1" />
				</svg>
				<span class="sr-only">{t("pagination.morePages")}</span>
			</PaginationEllipsisPrimitive>
		</li>
	);
};

type PaginationPreviousProps = ClassProps<
	ComponentProps<typeof PaginationPreviousPrimitive>
>;

const PaginationPrevious = (props: PaginationPreviousProps) => {
	const others = omit(props, "class", "children");
	return (
		<li>
			<PaginationPreviousPrimitive
				class={cn(
					buttonVariants({
						variant: "ghost",
					}),
					"min-h-11 gap-1 pl-2.5 sm:min-h-9",
					props.class,
				)}
				{...others}
			>
				<Show
					fallback={
						<>
							<svg
								aria-hidden="true"
								class="size-4"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path d="M15 6l-6 6l6 6" />
							</svg>
							<span>{t("actions.previous")}</span>
						</>
					}
					when={props.children}
				>
					{(children) => children()}
				</Show>
			</PaginationPreviousPrimitive>
		</li>
	);
};

type PaginationNextProps = ClassProps<
	ComponentProps<typeof PaginationNextPrimitive>
>;

const PaginationNext = (props: PaginationNextProps) => {
	const others = omit(props, "class", "children");
	return (
		<li>
			<PaginationNextPrimitive
				class={cn(
					buttonVariants({
						variant: "ghost",
					}),
					"min-h-11 gap-1 pr-2.5 sm:min-h-9",
					props.class,
				)}
				{...others}
			>
				<Show
					fallback={
						<>
							<span>{t("actions.next")}</span>
							<svg
								aria-hidden="true"
								class="size-4"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path d="M9 6l6 6l-6 6" />
							</svg>
						</>
					}
					when={props.children}
				>
					{(children) => children()}
				</Show>
			</PaginationNextPrimitive>
		</li>
	);
};

export {
	Pagination,
	PaginationEllipsis,
	PaginationItem,
	PaginationItems,
	PaginationNext,
	PaginationPrevious,
};
