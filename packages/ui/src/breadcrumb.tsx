import { Polymorphic, type PolymorphicProps } from "./utils/polymorphic";
import { t } from "@solid-imager/i18n";
import type { Component } from "solid-js";
import type { ComponentProps, JSX, ValidComponent } from "@solidjs/web";
import { Show, omit } from "solid-js";

import { cn } from "./utils/cn";

const Breadcrumb: Component<ComponentProps<"nav">> = (props) => (
	<nav aria-label={t("appShell.navigation")} {...props} />
);

const BreadcrumbList: Component<ComponentProps<"ol">> = (props) => {
	const others = omit(props, "class");
	return (
		<ol
			class={cn(
				"flex flex-wrap items-center gap-1.5 break-words text-muted-foreground text-sm sm:gap-2.5",
				props.class,
			)}
			{...others}
		/>
	);
};

const BreadcrumbItem: Component<ComponentProps<"li">> = (props) => {
	const others = omit(props, "class");
	return (
		<li
			class={cn("inline-flex items-center gap-1.5", props.class)}
			{...others}
		/>
	);
};

type BreadcrumbLinkProps = ComponentProps<"a"> & { current?: boolean } & {
	class?: string | undefined;
};

const BreadcrumbLink = <T extends ValidComponent = "a">(
	props: PolymorphicProps<T, BreadcrumbLinkProps>,
) => {
	const others = omit(
		props as BreadcrumbLinkProps & { as?: ValidComponent },
		"class",
		"as",
		"current",
	);
	return (
		<Polymorphic
			as={props.as ?? "a"}
			aria-current={props.current ? "page" : undefined}
			data-current={props.current ? "" : undefined}
			class={cn(
				"transition-colors hover:text-foreground data-[current]:font-normal data-[current]:text-foreground",
				props.class,
			)}
			{...others}
		/>
	);
};

type BreadcrumbSeparatorProps = ComponentProps<"span"> & {
	class?: string | undefined;
	children?: JSX.Element;
};

const BreadcrumbSeparator = <T extends ValidComponent = "span">(
	props: PolymorphicProps<T, BreadcrumbSeparatorProps>,
) => {
	const others = omit(
		props as BreadcrumbSeparatorProps & { as?: ValidComponent },
		"class",
		"children",
		"as",
	);
	return (
		<Polymorphic
			as={props.as ?? "span"}
			aria-hidden="true"
			class={cn("[&>svg]:size-3.5", props.class)}
			{...others}
		>
			<Show
				fallback={
					<svg
						aria-hidden="true"
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
				}
				when={props.children}
			>
				{props.children}
			</Show>
		</Polymorphic>
	);
};

const BreadcrumbEllipsis: Component<ComponentProps<"span">> = (props) => {
	const others = omit(props, "class");
	return (
		<span
			class={cn("flex size-9 items-center justify-center", props.class)}
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
				<path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
				<path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
				<path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
			</svg>
			<span class="sr-only">{t("breadcrumb.more")}</span>
		</span>
	);
};

export {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
};
