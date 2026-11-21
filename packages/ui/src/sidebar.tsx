import { Root as ButtonPrimitiveRoot } from "@kobalte/core/button";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { Polymorphic } from "@kobalte/core/polymorphic";
import * as SeparatorPrimitive from "@kobalte/core/separator";
import * as TextFieldPrimitive from "@kobalte/core/text-field";
import { t } from "@solid-imager/i18n";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type {
	Accessor,
	Component,
	ComponentProps,
	ValidComponent,
} from "solid-js";
import {
	createContext,
	mergeProps,
	onCleanup,
	onMount,
	Show,
	splitProps,
	Switch,
	Match,
	useContext,
} from "solid-js";
import { createSignal } from "solid-js";

import type { ButtonProps } from "./button";
import { buttonVariants } from "./button";
import { Sheet, SheetContent } from "./sheet";
import { Skeleton } from "./skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "./utils/cn";

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_COOKIE_NAME = "sidebar:state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextValue = {
	state: Accessor<"expanded" | "collapsed">;
	open: Accessor<boolean>;
	setOpen: (open: boolean) => void;
	openMobile: Accessor<boolean>;
	setOpenMobile: (open: boolean) => void;
	isMobile: Accessor<boolean>;
	toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useSidebar() {
	const context = useContext(SidebarContext);
	if (!context) {
		throw new Error(t("sidebar.missingProvider"));
	}

	return context;
}

export function useIsMobile(fallback = false) {
	const [isMobile, setIsMobile] = createSignal(fallback);

	onMount(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
			setIsMobile(event.matches);
		};
		mql.addEventListener("change", onChange);
		onChange(mql);
		onCleanup(() => mql.removeEventListener("change", onChange));
	});

	return isMobile;
}

type SidebarProviderProps = ComponentProps<"div"> & {
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	enableKeyboardShortcut?: boolean;
};

const SidebarProvider: Component<SidebarProviderProps> = (rawProps) => {
	const props = mergeProps(
		{ defaultOpen: true, enableKeyboardShortcut: true },
		rawProps,
	);
	const [local, others] = splitProps(props, [
		"defaultOpen",
		"open",
		"onOpenChange",
		"enableKeyboardShortcut",
		"class",
		"children",
	]);

	const isMobile = useIsMobile();
	const [openMobile, setOpenMobile] = createSignal(false);

	const [_open, _setOpen] = createSignal(local.defaultOpen);
	const open = () => local.open ?? _open();
	const setOpen = (value: boolean | ((previous: boolean) => boolean)) => {
		const nextValue = typeof value === "function" ? value(open()) : value;
		if (local.open === undefined) {
			_setOpen(nextValue);
		}
		local.onOpenChange?.(nextValue);
		if (typeof document !== "undefined") {
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${nextValue}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
		}
	};

	const toggleSidebar = () =>
		isMobile()
			? setOpenMobile((previous) => !previous)
			: setOpen((previous) => !previous);

	onMount(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				local.enableKeyboardShortcut &&
				event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
				(event.metaKey || event.ctrlKey)
			) {
				event.preventDefault();
				toggleSidebar();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
	});

	const state = () => (open() ? "expanded" : "collapsed");

	const contextValue: SidebarContextValue = {
		state,
		open,
		setOpen,
		isMobile,
		openMobile,
		setOpenMobile,
		toggleSidebar,
	};

	return (
		<SidebarContext.Provider value={contextValue}>
			<div
				class={cn(
					"group/sidebar-wrapper flex min-h-dvh w-full text-foreground has-[[data-variant=inset]]:bg-background",
					local.class,
				)}
				{...others}
			>
				{local.children}
			</div>
		</SidebarContext.Provider>
	);
};

type SidebarProps = ComponentProps<"div"> & {
	side?: "left" | "right";
	variant?: "sidebar" | "floating" | "inset";
	collapsible?: "offcanvas" | "icon" | "none";
};

const Sidebar: Component<SidebarProps> = (rawProps) => {
	const props = mergeProps<SidebarProps[]>(
		{
			side: "left",
			variant: "sidebar",
			collapsible: "offcanvas",
		},
		rawProps,
	);
	const [local, others] = splitProps(props, [
		"side",
		"variant",
		"collapsible",
		"class",
		"children",
	]);

	const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

	return (
		<Switch>
			<Match when={local.collapsible === "none"}>
				<div
					class={cn(
						"flex h-full w-64 flex-col bg-background text-foreground",
						local.class,
					)}
					{...others}
				>
					{local.children}
				</div>
			</Match>
			<Match when={isMobile()}>
				<Sheet onOpenChange={setOpenMobile} open={openMobile()} {...others}>
					<SheetContent
						class="w-72 bg-background p-0 text-foreground [&>button]:hidden"
						data-mobile="true"
						data-sidebar="sidebar"
						position={local.side}
					>
						<div class="flex size-full flex-col">{local.children}</div>
					</SheetContent>
				</Sheet>
			</Match>
			<Match when={!isMobile()}>
				<div
					class="group peer hidden md:block"
					data-collapsible={state() === "collapsed" ? local.collapsible : ""}
					data-side={local.side}
					data-state={state()}
					data-variant={local.variant}
				>
					<div
						class={cn(
							"relative h-dvh w-64 bg-transparent transition-width duration-200 ease-linear",
							"group-data-[collapsible=offcanvas]:w-0",
							"group-data-[side=right]:rotate-180",
							local.variant === "floating" || local.variant === "inset"
								? "group-data-[collapsible=icon]:w-20"
								: "group-data-[collapsible=icon]:w-16",
						)}
					/>
					<div
						class={cn(
							"fixed inset-y-0 z-10 hidden h-dvh w-64 transition-all duration-200 ease-linear md:flex",
							local.side === "left"
								? "left-0 group-data-[collapsible=offcanvas]:-left-64"
								: "right-0 group-data-[collapsible=offcanvas]:-right-64",
							local.variant === "floating" || local.variant === "inset"
								? "p-2 group-data-[collapsible=icon]:w-20"
								: "group-data-[side=left]:border-r group-data-[side=right]:border-l group-data-[collapsible=icon]:w-16",
							local.class,
						)}
						{...others}
					>
						<div
							class="flex size-full flex-col bg-background group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-border group-data-[variant=floating]:shadow"
							data-sidebar="sidebar"
						>
							{local.children}
						</div>
					</div>
				</div>
			</Match>
		</Switch>
	);
};

type SidebarTriggerProps<T extends ValidComponent = "button"> =
	ButtonProps<T> & {
		onClick?: (event: MouseEvent) => void;
	};

const SidebarTrigger = <T extends ValidComponent = "button">(
	props: SidebarTriggerProps<T>,
) => {
	const [local, others] = splitProps(props as SidebarTriggerProps, [
		"class",
		"onClick",
	]);
	const { toggleSidebar } = useSidebar();

	return (
		<ButtonPrimitiveRoot
			class={cn(
				buttonVariants({ variant: "ghost", size: "icon" }),
				"size-7",
				local.class,
			)}
			data-sidebar="trigger"
			onClick={(event: MouseEvent) => {
				local.onClick?.(event);
				toggleSidebar();
			}}
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
			>
				<rect height="18" rx="2" width="18" x="3" y="3" />
				<path d="M9 3v18" />
			</svg>
			<span class="sr-only">{t("definitions.toggleSidebar")}</span>
		</ButtonPrimitiveRoot>
	);
};

const SidebarRail: Component<ComponentProps<"button">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	const { toggleSidebar } = useSidebar();

	return (
		<button
			aria-label={t("definitions.toggleSidebar")}
			class={cn(
				"group-data-[collapsible=offcanvas]:hover:bg-accent group-data-[side=left]:-right-4 group-data-[collapsible=offcanvas]:translate-x-0 group-data-[side=right]:left-0 group-data-[collapsible=offcanvas]:after:left-full absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 hover:after:bg-border sm:flex",
				"group-data-[side=left]:cursor-w-resize group-data-[side=right]:cursor-e-resize",
				"group-data-[side=left]:group-data-[state=collapsed]:cursor-e-resize group-data-[side=right]:group-data-[state=collapsed]:cursor-w-resize",
				"group-data-[side=left]:group-data-[collapsible=offcanvas]:-right-2 group-data-[side=right]:group-data-[collapsible=offcanvas]:-left-2",
				local.class,
			)}
			data-sidebar="rail"
			onClick={toggleSidebar}
			tabIndex={-1}
			title={t("definitions.toggleSidebar")}
			type="button"
			{...others}
		/>
	);
};

const SidebarInset: Component<ComponentProps<"main">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<main
			class={cn(
				"relative flex min-h-dvh flex-1 flex-col bg-background",
				"peer-data-[variant=inset]:min-h-dvh md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
				local.class,
			)}
			{...others}
		/>
	);
};

type SidebarInputProps<T extends ValidComponent = "input"> =
	TextFieldPrimitive.TextFieldInputProps<T> & { class?: string | undefined };

const SidebarInput = <T extends ValidComponent = "input">(
	props: PolymorphicProps<T, SidebarInputProps<T>>,
) => {
	const [local, others] = splitProps(props as SidebarInputProps, ["class"]);
	return (
		<TextFieldPrimitive.Root class="flex flex-col gap-1">
			<TextFieldPrimitive.Input
				class={cn(
					"flex h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-none ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
					local.class,
				)}
				data-sidebar="input"
				{...others}
			/>
		</TextFieldPrimitive.Root>
	);
};

const SidebarHeader: Component<ComponentProps<"div">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<div
			class={cn("flex flex-col gap-2 p-2", local.class)}
			data-sidebar="header"
			{...others}
		/>
	);
};

const SidebarFooter: Component<ComponentProps<"div">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<div
			class={cn("flex flex-col gap-2 p-2", local.class)}
			data-sidebar="footer"
			{...others}
		/>
	);
};

type SidebarSeparatorProps<T extends ValidComponent = "hr"> =
	SeparatorPrimitive.SeparatorRootProps<T> & { class?: string | undefined };

const SidebarSeparator = <T extends ValidComponent = "hr">(
	props: PolymorphicProps<T, SidebarSeparatorProps<T>>,
) => {
	const [local, others] = splitProps(props as SidebarSeparatorProps, ["class"]);
	return (
		<SeparatorPrimitive.Root
			class={cn("mx-2 h-px w-auto shrink-0 bg-border", local.class)}
			data-sidebar="separator"
			{...others}
		/>
	);
};

const SidebarContent: Component<ComponentProps<"div">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<div
			class={cn(
				"flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
				local.class,
			)}
			data-sidebar="content"
			{...others}
		/>
	);
};

const SidebarGroup: Component<ComponentProps<"div">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<div
			class={cn("relative flex w-full min-w-0 flex-col p-2", local.class)}
			data-sidebar="group"
			{...others}
		/>
	);
};

type SidebarGroupLabelProps<T extends ValidComponent = "div"> =
	ComponentProps<T>;

const SidebarGroupLabel = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, SidebarGroupLabelProps<T>>,
) => {
	const [local, others] = splitProps(props as SidebarGroupLabelProps, [
		"class",
	]);

	return (
		<Polymorphic<SidebarGroupLabelProps>
			as="div"
			class={cn(
				"flex h-8 shrink-0 items-center rounded-md px-2 font-medium text-muted-foreground text-xs outline-none ring-ring transition-all duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
				"group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
				local.class,
			)}
			data-sidebar="group-label"
			{...others}
		/>
	);
};

type SidebarGroupActionProps<T extends ValidComponent = "button"> =
	ComponentProps<T>;

const SidebarGroupAction = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, SidebarGroupActionProps<T>>,
) => {
	const [local, others] = splitProps(props as SidebarGroupActionProps, [
		"class",
	]);
	return (
		<Polymorphic<SidebarGroupActionProps>
			as="button"
			class={cn(
				"absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-foreground outline-none ring-ring transition-transform hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
				"after:absolute after:-inset-2 after:md:hidden",
				"group-data-[collapsible=icon]:hidden",
				local.class,
			)}
			data-sidebar="group-action"
			{...others}
		/>
	);
};

const SidebarGroupContent: Component<ComponentProps<"div">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<div
			class={cn("w-full text-sm", local.class)}
			data-sidebar="group-content"
			{...others}
		/>
	);
};

const SidebarMenu: Component<ComponentProps<"ul">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<ul
			class={cn("flex w-full min-w-0 flex-col gap-1", local.class)}
			data-sidebar="menu"
			{...others}
		/>
	);
};

const SidebarMenuItem: Component<ComponentProps<"li">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<li
			class={cn("group/menu-item relative", local.class)}
			data-sidebar="menu-item"
			{...others}
		/>
	);
};

const sidebarMenuButtonVariants = cva(
	"peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-ring transition-all hover:bg-muted hover:text-foreground focus-visible:ring-2 active:bg-accent active:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-accent-foreground data-[state=open]:hover:bg-muted data-[state=open]:hover:text-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "hover:bg-muted hover:text-foreground",
				outline:
					"border border-border bg-background shadow-xs hover:bg-muted hover:text-foreground",
			},
			size: {
				default: "h-8 text-sm",
				sm: "h-7 text-xs",
				lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type SidebarMenuButtonProps<T extends ValidComponent = "button"> =
	ComponentProps<T> &
		VariantProps<typeof sidebarMenuButtonVariants> & {
			isActive?: boolean;
			tooltip?: string;
		};

const SidebarMenuButton = <T extends ValidComponent = "button">(
	rawProps: PolymorphicProps<T, SidebarMenuButtonProps<T>>,
) => {
	const props = mergeProps(
		{ isActive: false, variant: "default", size: "default" },
		rawProps,
	);
	const [local, others] = splitProps(
		props as SidebarMenuButtonProps & { as?: ValidComponent },
		["as", "type", "isActive", "tooltip", "variant", "size", "class"],
	);
	const { isMobile, state } = useSidebar();
	const component = () => local.as ?? "button";
	const buttonType = (): "button" | "submit" | "reset" | undefined =>
		local.type === "submit" || local.type === "reset" || local.type === "button"
			? local.type
			: component() === "button"
				? "button"
				: undefined;

	return (
		<Show
			fallback={
				<Polymorphic<SidebarMenuButtonProps>
					as={component()}
					class={cn(
						sidebarMenuButtonVariants({
							variant: local.variant,
							size: local.size,
						}),
						local.class,
					)}
					data-active={local.isActive}
					data-sidebar="menu-button"
					data-size={local.size}
					type={buttonType()}
					{...others}
				/>
			}
			when={local.tooltip}
		>
			<Tooltip placement="right">
				<TooltipTrigger
					as={component()}
					class={cn(
						// oxlint-disable-next-line shadcn/require-static-classes -- SidebarMenuButton forwards CVA variant classes to TooltipTrigger.
						sidebarMenuButtonVariants({
							variant: local.variant,
							size: local.size,
						}),
						// oxlint-disable-next-line shadcn/require-static-classes -- SidebarMenuButton forwards caller class override to TooltipTrigger.
						local.class,
					)}
					data-active={local.isActive}
					data-sidebar="menu-button"
					data-size={local.size}
					type={buttonType()}
					{...others}
				/>
				<TooltipContent hidden={state() !== "collapsed" || isMobile()}>
					{local.tooltip}
				</TooltipContent>
			</Tooltip>
		</Show>
	);
};

type SidebarMenuActionProps<T extends ValidComponent = "button"> =
	ComponentProps<T> & {
		showOnHover?: boolean;
	};

const SidebarMenuAction = <T extends ValidComponent = "button">(
	rawProps: PolymorphicProps<T, SidebarMenuActionProps<T>>,
) => {
	const props = mergeProps({ showOnHover: false }, rawProps);
	const [local, others] = splitProps(props as SidebarMenuActionProps, [
		"class",
		"showOnHover",
	]);

	return (
		<Polymorphic<SidebarMenuActionProps>
			as="button"
			class={cn(
				"absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-foreground outline-none ring-ring transition-transform hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
				"after:absolute after:-inset-2 after:md:hidden",
				"peer-data-[size=sm]/menu-button:top-1",
				"peer-data-[size=default]/menu-button:top-1.5",
				"peer-data-[size=lg]/menu-button:top-2.5",
				"group-data-[collapsible=icon]:hidden",
				local.showOnHover &&
					"group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-accent-foreground md:opacity-0",
				local.class,
			)}
			data-sidebar="menu-action"
			{...others}
		/>
	);
};

const SidebarMenuBadge: Component<ComponentProps<"div">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<div
			class={cn(
				"pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 font-medium text-foreground text-xs tabular-nums",
				"peer-hover/menu-button:text-accent-foreground peer-data-[active=true]/menu-button:text-accent-foreground",
				"peer-data-[size=sm]/menu-button:top-1",
				"peer-data-[size=default]/menu-button:top-1.5",
				"peer-data-[size=lg]/menu-button:top-2.5",
				"group-data-[collapsible=icon]:hidden",
				local.class,
			)}
			data-sidebar="menu-badge"
			{...others}
		/>
	);
};

type SidebarMenuSkeletonProps = ComponentProps<"div"> & {
	showIcon?: boolean;
};

const SidebarMenuSkeleton: Component<SidebarMenuSkeletonProps> = (rawProps) => {
	const props = mergeProps({ showIcon: false }, rawProps);
	const [local, others] = splitProps(props, ["class", "showIcon"]);

	return (
		<div
			class={cn("flex h-8 items-center gap-2 rounded-md px-2", local.class)}
			data-sidebar="menu-skeleton"
			{...others}
		>
			{local.showIcon && (
				<Skeleton class="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />
			)}
			<Skeleton class="h-4 w-3/4 flex-1" data-sidebar="menu-skeleton-text" />
		</div>
	);
};

const SidebarMenuSub: Component<ComponentProps<"ul">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<ul
			class={cn(
				"mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-border border-l px-2.5 py-0.5",
				"group-data-[collapsible=icon]:hidden",
				local.class,
			)}
			data-sidebar="menu-sub"
			{...others}
		/>
	);
};

const SidebarMenuSubItem: Component<ComponentProps<"li">> = (props) => (
	<li {...props} />
);

type SidebarMenuSubButtonProps<T extends ValidComponent = "a"> =
	ComponentProps<T> & {
		size?: "sm" | "md";
		isActive?: boolean;
	};

const SidebarMenuSubButton = <T extends ValidComponent = "a">(
	rawProps: PolymorphicProps<T, SidebarMenuSubButtonProps<T>>,
) => {
	const props = mergeProps({ size: "md" }, rawProps);
	const [local, others] = splitProps(props as SidebarMenuSubButtonProps, [
		"size",
		"isActive",
		"class",
	]);

	return (
		<Polymorphic<SidebarMenuSubButtonProps>
			as="a"
			class={cn(
				"flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-foreground outline-none ring-ring hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 active:bg-accent active:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-accent-foreground",
				"data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
				local.size === "sm" && "text-xs",
				local.size === "md" && "text-sm",
				"group-data-[collapsible=icon]:hidden",
				local.class,
			)}
			data-active={local.isActive}
			data-sidebar="menu-sub-button"
			data-size={local.size}
			{...others}
		/>
	);
};

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
};
