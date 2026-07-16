import {
	CloseButton as AlertDialogPrimitiveCloseButton,
	Content as AlertDialogPrimitiveContent,
	Description as AlertDialogPrimitiveDescription,
	Overlay as AlertDialogPrimitiveOverlay,
	Portal as AlertDialogPrimitivePortal,
	Root as AlertDialogPrimitiveRoot,
	Title as AlertDialogPrimitiveTitle,
	Trigger as AlertDialogPrimitiveTrigger,
} from "@kobalte/core/alert-dialog";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { buttonVariants } from "./button";
import { cn } from "./utils/cn";

const AlertDialog = AlertDialogPrimitiveRoot;
const AlertDialogTrigger = AlertDialogPrimitiveTrigger;

const AlertDialogPortal: Component<
	ComponentProps<typeof AlertDialogPrimitivePortal>
> = (props) => {
	const [, rest] = splitProps(props, ["children"]);
	return (
		<AlertDialogPrimitivePortal {...rest}>
			<div class="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
				{props.children}
			</div>
		</AlertDialogPrimitivePortal>
	);
};

const AlertDialogOverlay: Component<
	ComponentProps<typeof AlertDialogPrimitiveOverlay>
> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<AlertDialogPrimitiveOverlay
			class={cn(
				"data-[closed]:fade-out-0 data-[expanded]:fade-in-0 fixed inset-0 z-50 bg-background/80 data-[closed]:animate-out data-[expanded]:animate-in",
				props.class,
			)}
			{...rest}
		/>
	);
};

const AlertDialogContent: Component<
	ComponentProps<typeof AlertDialogPrimitiveContent>
> = (props) => {
	const [, rest] = splitProps(props, ["class", "children"]);
	return (
		<AlertDialogPrimitivePortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitiveContent
				class={cn(
					"-translate-x-1/2 -translate-y-1/2 data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%] fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[calc(100%-2rem)] max-w-lg gap-4 overflow-y-auto overscroll-contain border bg-background p-6 shadow-lg duration-200 data-[closed]:animate-out data-[expanded]:animate-in sm:max-h-[calc(100dvh-4rem)] sm:rounded-lg",
					props.class,
				)}
				{...rest}
			>
				{props.children}
			</AlertDialogPrimitiveContent>
		</AlertDialogPrimitivePortal>
	);
};

const AlertDialogHeader: Component<ComponentProps<"div">> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<div
			class={cn(
				"sticky top-0 z-10 shrink-0 space-y-2 bg-background text-center sm:text-left",
				props.class,
			)}
			{...rest}
		/>
	);
};

const AlertDialogFooter: Component<ComponentProps<"div">> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<div
			class={cn(
				"sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-2 bg-background sm:flex-row sm:justify-end [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:w-auto",
				props.class,
			)}
			{...rest}
		/>
	);
};

const AlertDialogTitle: Component<
	ComponentProps<typeof AlertDialogPrimitiveTitle>
> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<AlertDialogPrimitiveTitle
			class={cn("font-semibold text-lg", props.class)}
			{...rest}
		/>
	);
};

const AlertDialogDescription: Component<
	ComponentProps<typeof AlertDialogPrimitiveDescription>
> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<AlertDialogPrimitiveDescription
			class={cn("text-muted-foreground text-sm", props.class)}
			{...rest}
		/>
	);
};

const AlertDialogAction: Component<
	ComponentProps<typeof AlertDialogPrimitiveCloseButton>
> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<AlertDialogPrimitiveCloseButton
			class={cn(buttonVariants(), props.class)}
			{...rest}
		/>
	);
};

const AlertDialogCancel: Component<
	ComponentProps<typeof AlertDialogPrimitiveCloseButton>
> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<AlertDialogPrimitiveCloseButton
			class={cn(
				buttonVariants({ variant: "outline" }),
				"mt-2 sm:mt-0",
				props.class,
			)}
			{...rest}
		/>
	);
};

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger,
};
