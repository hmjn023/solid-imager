import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import {
	Content as SelectPrimitiveContent,
	type SelectContentProps as SelectPrimitiveContentProps,
	Description as SelectPrimitiveDescription,
	type SelectDescriptionProps as SelectPrimitiveDescriptionProps,
	ErrorMessage as SelectPrimitiveErrorMessage,
	type SelectErrorMessageProps as SelectPrimitiveErrorMessageProps,
	HiddenSelect as SelectPrimitiveHiddenSelect,
	Icon as SelectPrimitiveIcon,
	Item as SelectPrimitiveItem,
	ItemIndicator as SelectPrimitiveItemIndicator,
	ItemLabel as SelectPrimitiveItemLabel,
	type SelectItemProps as SelectPrimitiveItemProps,
	Label as SelectPrimitiveLabel,
	type SelectLabelProps as SelectPrimitiveLabelProps,
	Listbox as SelectPrimitiveListbox,
	Portal as SelectPrimitivePortal,
	Root as SelectPrimitiveRoot,
	Trigger as SelectPrimitiveTrigger,
	type SelectTriggerProps as SelectPrimitiveTriggerProps,
	Value as SelectPrimitiveValue,
} from "@kobalte/core/select";
import { cva } from "class-variance-authority";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "./utils/cn";

const Select = SelectPrimitiveRoot;
const SelectValue = SelectPrimitiveValue;
const SelectHiddenSelect = SelectPrimitiveHiddenSelect;

type SelectTriggerProps<T extends ValidComponent = "button"> =
	SelectPrimitiveTriggerProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

const SelectTrigger = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, SelectTriggerProps<T>>,
) => {
	const [local, others] = splitProps(props as SelectTriggerProps, [
		"class",
		"children",
	]);
	return (
		<SelectPrimitiveTrigger
			class={cn(
				"flex min-h-11 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
				local.class,
			)}
			{...others}
		>
			{local.children}
			<SelectPrimitiveIcon
				as="svg"
				class="size-4 opacity-50"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M8 9l4 -4l4 4" />
				<path d="M16 15l-4 4l-4 -4" />
			</SelectPrimitiveIcon>
		</SelectPrimitiveTrigger>
	);
};

type SelectContentProps<T extends ValidComponent = "div"> =
	SelectPrimitiveContentProps<T> & {
		class?: string | undefined;
	};

const SelectContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, SelectContentProps<T>>,
) => {
	const [local, others] = splitProps(props as SelectContentProps, ["class"]);
	return (
		<SelectPrimitivePortal>
			<SelectPrimitiveContent
				class={cn(
					"fade-in-80 relative z-50 max-h-[min(24rem,calc(100dvh-2rem))] min-w-32 max-w-[calc(100dvw-2rem)] animate-in overflow-y-auto overflow-x-hidden overscroll-contain rounded-md border bg-popover text-popover-foreground shadow-md",
					local.class,
				)}
				{...others}
			>
				<SelectPrimitiveListbox class="m-0 p-1" />
			</SelectPrimitiveContent>
		</SelectPrimitivePortal>
	);
};

type SelectItemProps<T extends ValidComponent = "li"> =
	SelectPrimitiveItemProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

const SelectItem = <T extends ValidComponent = "li">(
	props: PolymorphicProps<T, SelectItemProps<T>>,
) => {
	const [local, others] = splitProps(props as SelectItemProps, [
		"class",
		"children",
	]);
	return (
		<SelectPrimitiveItem
			class={cn(
				"relative mt-0 flex min-h-11 w-full cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				local.class,
			)}
			{...others}
		>
			<SelectPrimitiveItemIndicator class="absolute right-2 flex size-3.5 items-center justify-center">
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
					<title>Check</title>
					<path d="M0 0h24v24H0z" fill="none" stroke="none" />
					<path d="M5 12l5 5l10 -10" />
				</svg>
			</SelectPrimitiveItemIndicator>
			<SelectPrimitiveItemLabel>{local.children}</SelectPrimitiveItemLabel>
		</SelectPrimitiveItem>
	);
};

const labelVariants = cva(
	"font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
	{
		variants: {
			variant: {
				label: "data-[invalid]:text-destructive",
				description: "font-normal text-muted-foreground",
				error: "text-destructive text-xs",
			},
		},
		defaultVariants: {
			variant: "label",
		},
	},
);

type SelectLabelProps<T extends ValidComponent = "label"> =
	SelectPrimitiveLabelProps<T> & {
		class?: string | undefined;
	};

const SelectLabel = <T extends ValidComponent = "label">(
	props: PolymorphicProps<T, SelectLabelProps<T>>,
) => {
	const [local, others] = splitProps(props as SelectLabelProps, ["class"]);
	return (
		<SelectPrimitiveLabel
			class={cn(labelVariants(), local.class)}
			{...others}
		/>
	);
};

type SelectDescriptionProps<T extends ValidComponent = "div"> =
	SelectPrimitiveDescriptionProps<T> & {
		class?: string | undefined;
	};

const SelectDescription = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, SelectDescriptionProps<T>>,
) => {
	const [local, others] = splitProps(props as SelectDescriptionProps, [
		"class",
	]);
	return (
		<SelectPrimitiveDescription
			class={cn(labelVariants({ variant: "description" }), local.class)}
			{...others}
		/>
	);
};

type SelectErrorMessageProps<T extends ValidComponent = "div"> =
	SelectPrimitiveErrorMessageProps<T> & {
		class?: string | undefined;
	};

const SelectErrorMessage = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, SelectErrorMessageProps<T>>,
) => {
	const [local, others] = splitProps(props as SelectErrorMessageProps, [
		"class",
	]);
	return (
		<SelectPrimitiveErrorMessage
			class={cn(labelVariants({ variant: "error" }), local.class)}
			{...others}
		/>
	);
};

export {
	Select,
	SelectContent,
	SelectDescription,
	SelectErrorMessage,
	SelectHiddenSelect,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
};
