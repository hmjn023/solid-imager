import {
	Content as AlertDialogPrimitiveContent,
	Description as AlertDialogPrimitiveDescription,
	Overlay as AlertDialogPrimitiveOverlay,
	Portal as AlertDialogPrimitivePortal,
	Root as AlertDialogPrimitiveRoot,
	Title as AlertDialogPrimitiveTitle,
	Trigger as AlertDialogPrimitiveTrigger,
} from "@kobalte/core/alert-dialog";
import { useDialogContext } from "@kobalte/core/dialog";
import type { Component, ComponentProps, JSX } from "solid-js";
import { splitProps } from "solid-js";
import { Button } from "./button";
import { cn } from "./utils/cn";

type ClassProps<T> = Omit<T, "class"> & { class?: string | undefined };

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
	ClassProps<ComponentProps<typeof AlertDialogPrimitiveOverlay>>
> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<AlertDialogPrimitiveOverlay
			class={cn(
				"fixed inset-0 z-50 bg-background/80 motion-safe:data-[closed]:animate-out motion-safe:data-[expanded]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[expanded]:fade-in-0",
				props.class,
			)}
			{...rest}
		/>
	);
};

const AlertDialogContent: Component<
	ClassProps<ComponentProps<typeof AlertDialogPrimitiveContent>>
> = (props) => {
	const [, rest] = splitProps(props, ["class", "children"]);
	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitiveContent
				class={cn(
					"fixed top-1/2 left-1/2 z-50 grid max-h-dialog-safe w-dialog-inset max-w-lg -translate-x-1/2 -translate-y-1/2 origin-center gap-4 overflow-y-auto overscroll-contain scrollbar-stable rounded-lg border bg-background p-6 shadow-lg duration-200 motion-safe:data-[closed]:animate-out motion-safe:data-[expanded]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[expanded]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[expanded]:zoom-in-95 sm:max-h-dialog-safe",
					props.class,
				)}
				{...rest}
			>
				{props.children}
			</AlertDialogPrimitiveContent>
		</AlertDialogPortal>
	);
};

const AlertDialogHeader: Component<ComponentProps<"div">> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<div
			class={cn(
				"sticky top-0 z-10 -mt-6 shrink-0 space-y-2 bg-background pt-6 text-center sm:text-left",
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
				"sticky bottom-0 z-10 -mb-6 flex shrink-0 flex-col-reverse gap-2 bg-background pb-6 sm:flex-row sm:justify-end [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:w-auto",
				props.class,
			)}
			{...rest}
		/>
	);
};

const AlertDialogTitle: Component<
	ClassProps<ComponentProps<typeof AlertDialogPrimitiveTitle>>
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
	ClassProps<ComponentProps<typeof AlertDialogPrimitiveDescription>>
> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<AlertDialogPrimitiveDescription
			class={cn("text-muted-foreground text-sm", props.class)}
			{...rest}
		/>
	);
};

type AlertDialogButtonProps = ClassProps<
	ComponentProps<typeof Button<"button">>
>;

type AlertDialogButtonClickEvent = MouseEvent & {
	currentTarget: HTMLButtonElement;
	target: Element;
};

function invokeButtonClick(
	handler: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent> | undefined,
	event: AlertDialogButtonClickEvent,
) {
	if (!handler) return;
	if (typeof handler === "function") {
		handler(event);
		return;
	}
	handler[0](handler[1], event);
}

const AlertDialogButton: Component<AlertDialogButtonProps> = (props) => {
	const context = useDialogContext();
	const [local, rest] = splitProps(props, ["onClick"]);
	return (
		<Button
			onClick={(event: AlertDialogButtonClickEvent) => {
				invokeButtonClick(local.onClick, event);
				if (!event.defaultPrevented) {
					context.close();
				}
			}}
			{...rest}
		/>
	);
};

const AlertDialogAction: Component<AlertDialogButtonProps> = (props) => (
	<AlertDialogButton {...props} />
);

const AlertDialogCancel: Component<AlertDialogButtonProps> = (props) => {
	const [local, rest] = splitProps(props, ["class", "variant"]);
	return (
		<AlertDialogButton
			class={cn("mt-2 sm:mt-0", local.class)}
			variant={local.variant ?? "outline"}
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
