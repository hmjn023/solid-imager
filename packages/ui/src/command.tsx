// Adapted from the Solid UI v2 command registry recipe.
import Search from "@lucide/solid/icons/search";
import { t } from "@solid-imager/i18n";
import * as CommandPrimitive from "@ui-sdk/solid/command";
import type { Component, ParentProps, VoidProps } from "solid-js";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import { InputGroup, InputGroupAddon } from "./input-group";
import { cn } from "./utils/cn";

type ClassProps<Props> = Omit<Props, "class" | "children"> & {
	class?: string;
	children?: JSX.Element;
};

const Command: Component<
	ParentProps<ClassProps<ComponentProps<typeof CommandPrimitive.Command>>>
> = (props) => {
	const others = omit(props, "class");

	return (
		<CommandPrimitive.Command
			class={cn(
				"flex size-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground blur-none",
				props.class,
			)}
			{...others}
		/>
	);
};

type CommandDialogProps = ParentProps<
	ComponentProps<typeof Dialog> & {
		description?: string;
		query?: string;
		onQueryChange?: (query: string) => void;
		loop?: boolean;
		title?: string;
	}
>;

const CommandDialog: Component<CommandDialogProps> = (props) => {
	const others = omit(
		props,
		"children",
		"description",
		"loop",
		"title",
		"query",
		"onQueryChange",
	);

	return (
		<Dialog {...others}>
			<DialogContent class="overflow-hidden p-0">
				<DialogHeader class="sr-only">
					<DialogTitle>
						{props.title ?? t("command.chooseAnAction")}
					</DialogTitle>
					<DialogDescription>
						{props.description ?? t("command.typeToFilterTheAvailableActions")}
					</DialogDescription>
				</DialogHeader>
				<Command
					class="[&_[data-command-group-label]]:px-2 [&_[data-command-group-label]]:font-medium [&_[data-command-group-label]]:text-muted-foreground [&_[data-command-group]:not([hidden])_~[data-command-group]]:pt-0 [&_[data-command-input-wrapper]_svg]:size-5 [&_[data-command-input]]:h-12 [&_[data-command-item]]:px-2 [&_[data-command-item]]:py-3 [&_[data-command-item]_svg]:size-5"
					loop={props.loop}
					query={props.query}
					onQueryChange={props.onQueryChange}
				>
					{props.children}
				</Command>
			</DialogContent>
		</Dialog>
	);
};

const CommandInput: Component<
	VoidProps<ClassProps<ComponentProps<typeof CommandPrimitive.CommandInput>>>
> = (props) => {
	const others = omit(props, "class", "aria-label");

	return (
		<InputGroup
			class="flex items-center border-b px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset"
			data-command-input-wrapper=""
		>
			<CommandPrimitive.CommandInput
				data-command-input=""
				data-ui="input-group-control"
				aria-label={props["aria-label"] ?? t("actions.search")}
				class={cn(
					"flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
					props.class,
				)}
				{...others}
			/>
			<InputGroupAddon class="mr-2">
				<Search aria-hidden="true" class="size-4 shrink-0 opacity-50" />
			</InputGroupAddon>
		</InputGroup>
	);
};

const CommandList: Component<
	ClassProps<ComponentProps<typeof CommandPrimitive.CommandList>> & {
		label?: string;
	}
> = (props) => {
	const others = omit(props, "class", "label");

	return (
		<CommandPrimitive.CommandList
			aria-label={props.label}
			class={cn("max-h-72 overflow-y-auto overflow-x-hidden", props.class)}
			{...others}
		/>
	);
};

const CommandEmpty: Component<
	ParentProps<ClassProps<ComponentProps<typeof CommandPrimitive.CommandEmpty>>>
> = (props) => {
	const others = omit(props, "class");

	return (
		<CommandPrimitive.CommandEmpty
			class={cn(
				"hidden py-6 text-center text-sm data-[empty]:block",
				props.class,
			)}
			{...others}
		/>
	);
};

const CommandGroup: Component<
	ClassProps<ComponentProps<typeof CommandPrimitive.CommandGroup>> & {
		heading?: string;
	}
> = (props) => {
	const others = omit(props, "class", "heading", "children");

	return (
		<CommandPrimitive.CommandGroup
			class={cn(
				"overflow-hidden p-1 text-foreground [&_[data-command-group-label]]:px-2 [&_[data-command-group-label]]:py-1.5 [&_[data-command-group-label]]:font-medium [&_[data-command-group-label]]:text-muted-foreground [&_[data-command-group-label]]:text-xs",
				props.class,
			)}
			data-command-group=""
			{...others}
		>
			{props.heading && (
				<CommandPrimitive.CommandGroupLabel data-command-group-label="">
					{props.heading}
				</CommandPrimitive.CommandGroupLabel>
			)}
			{props.children}
		</CommandPrimitive.CommandGroup>
	);
};

const CommandSeparator: Component<
	VoidProps<
		ClassProps<ComponentProps<typeof CommandPrimitive.CommandSeparator>>
	>
> = (props) => {
	const others = omit(props, "class");

	return (
		<CommandPrimitive.CommandSeparator
			class={cn("h-px bg-border", props.class)}
			{...others}
		/>
	);
};

const CommandItem: Component<
	ParentProps<ClassProps<ComponentProps<typeof CommandPrimitive.CommandItem>>>
> = (props) => {
	const others = omit(props, "class");

	return (
		<CommandPrimitive.CommandItem
			class={cn(
				"relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				props.class,
			)}
			data-command-item=""
			{...others}
		/>
	);
};

const CommandShortcut: Component<
	ClassProps<ComponentProps<typeof CommandPrimitive.CommandShortcut>>
> = (props) => {
	const others = omit(props, "class");

	return (
		<CommandPrimitive.CommandShortcut
			class={cn(
				"ml-auto text-muted-foreground text-xs tracking-widest",
				props.class,
			)}
			{...others}
		/>
	);
};

export {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
};
