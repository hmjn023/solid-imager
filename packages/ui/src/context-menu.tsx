import {
	CheckboxItem,
	Content,
	ContextMenu as ContextMenuPrimitive,
	Group,
	GroupLabel,
	Item,
	ItemIndicator,
	Portal,
	RadioGroup,
	RadioItem,
	Separator,
	Sub,
	SubContent,
	SubTrigger,
	Trigger,
} from "@kobalte/core/context-menu";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { Component, ComponentProps, JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "./utils/cn";

// removed aliases

const ContextMenuTrigger = Trigger;
const ContextMenuPortal = Portal;
const ContextMenuSub = Sub;
const ContextMenuGroup = Group;
const ContextMenuRadioGroup = RadioGroup;

const ContextMenu: Component<ComponentProps<typeof ContextMenuPrimitive>> = (
	props,
) => <ContextMenuPrimitive gutter={4} {...props} />;

type ContextMenuContentProps<_T extends ValidComponent = "div"> =
	ComponentProps<typeof Content> & {
		class?: string | undefined;
	};

const ContextMenuContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, ContextMenuContentProps<T>>,
) => {
	const [local, others] = splitProps(props as ContextMenuContentProps, [
		"class",
	]);
	return (
		<Portal>
			<Content
				class={cn(
					"z-50 min-w-32 origin-[var(--kb-menu-content-transform-origin)] animate-in overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
					local.class,
				)}
				{...others}
			/>
		</Portal>
	);
};

type ContextMenuItemProps<_T extends ValidComponent = "div"> = ComponentProps<
	typeof Item
> & {
	class?: string | undefined;
};

const ContextMenuItem = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, ContextMenuItemProps<T>>,
) => {
	const [local, others] = splitProps(props as ContextMenuItemProps, ["class"]);
	return (
		<Item
			class={cn(
				"relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				local.class,
			)}
			{...others}
		/>
	);
};

const ContextMenuShortcut: Component<ComponentProps<"span">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<span
			class={cn("ml-auto text-xs tracking-widest opacity-60", local.class)}
			{...others}
		/>
	);
};

type ContextMenuSeparatorProps<_T extends ValidComponent = "hr"> =
	ComponentProps<typeof Separator> & {
		class?: string | undefined;
	};

const ContextMenuSeparator = <T extends ValidComponent = "hr">(
	props: PolymorphicProps<T, ContextMenuSeparatorProps<T>>,
) => {
	const [local, others] = splitProps(props as ContextMenuSeparatorProps, [
		"class",
	]);
	return (
		<Separator
			class={cn("-mx-1 my-1 h-px bg-muted", local.class)}
			{...others}
		/>
	);
};

type ContextMenuSubTriggerProps<_T extends ValidComponent = "div"> =
	ComponentProps<typeof SubTrigger> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

const ContextMenuSubTrigger = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, ContextMenuSubTriggerProps<T>>,
) => {
	const [local, others] = splitProps(props as ContextMenuSubTriggerProps, [
		"class",
		"children",
	]);
	return (
		<SubTrigger
			class={cn(
				"flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent",
				local.class,
			)}
			{...others}
		>
			{local.children}
			<svg
				class="ml-auto size-4"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<title>Submenu</title>
				<path d="M9 6l6 6l-6 6" />
			</svg>
		</SubTrigger>
	);
};

type ContextMenuSubContentProps<_T extends ValidComponent = "div"> =
	ComponentProps<typeof SubContent> & {
		class?: string | undefined;
	};

const ContextMenuSubContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, ContextMenuSubContentProps<T>>,
) => {
	const [local, others] = splitProps(props as ContextMenuSubContentProps, [
		"class",
	]);
	return (
		<SubContent
			class={cn(
				"z-50 min-w-32 origin-[var(--kb-menu-content-transform-origin)] animate-in overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
				local.class,
			)}
			{...others}
		/>
	);
};

type ContextMenuCheckboxItemProps<_T extends ValidComponent = "div"> =
	ComponentProps<typeof CheckboxItem> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

const ContextMenuCheckboxItem = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, ContextMenuCheckboxItemProps<T>>,
) => {
	const [local, others] = splitProps(props as ContextMenuCheckboxItemProps, [
		"class",
		"children",
	]);
	return (
		<CheckboxItem
			class={cn(
				"relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				local.class,
			)}
			{...others}
		>
			<span class="absolute left-2 flex size-3.5 items-center justify-center">
				<ItemIndicator>
					<svg
						class="size-4"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>Checked</title>
						<path d="M5 12l5 5l10 -10" />
					</svg>
				</ItemIndicator>
			</span>
			{local.children}
		</CheckboxItem>
	);
};

type ContextMenuGroupLabelProps<_T extends ValidComponent = "span"> =
	ComponentProps<typeof GroupLabel> & {
		class?: string | undefined;
	};

const ContextMenuGroupLabel = <T extends ValidComponent = "span">(
	props: PolymorphicProps<T, ContextMenuGroupLabelProps<T>>,
) => {
	const [local, others] = splitProps(props as ContextMenuGroupLabelProps, [
		"class",
	]);
	return (
		<GroupLabel
			class={cn("px-2 py-1.5 font-semibold text-sm", local.class)}
			{...others}
		/>
	);
};

type ContextMenuRadioItemProps<_T extends ValidComponent = "div"> =
	ComponentProps<typeof RadioItem> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

const ContextMenuRadioItem = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, ContextMenuRadioItemProps<T>>,
) => {
	const [local, others] = splitProps(props as ContextMenuRadioItemProps, [
		"class",
		"children",
	]);
	return (
		<RadioItem
			class={cn(
				"relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				local.class,
			)}
			{...others}
		>
			<span class="absolute left-2 flex size-3.5 items-center justify-center">
				<ItemIndicator>
					<svg
						class="size-2 fill-current"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>Selected</title>
						<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
					</svg>
				</ItemIndicator>
			</span>
			{local.children}
		</RadioItem>
	);
};

export {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuGroupLabel,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
};
