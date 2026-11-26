import {
	AlertDialogBackdrop as AlertDialogPrimitiveOverlay,
	AlertDialogContent as AlertDialogPrimitiveContent,
	AlertDialogDescription as AlertDialogPrimitiveDescription,
	AlertDialogTitle as AlertDialogPrimitiveTitle,
	AlertDialog as AlertDialogPrimitiveRoot,
	AlertDialogTrigger as AlertDialogPrimitiveTrigger,
	createAlertDialogController,
} from "@ui-sdk/solid/alert-dialog";
import { createContext, useContext } from "solid-js";
import type { Component } from "solid-js";
import {
	Portal,
	type ComponentProps,
	type JSX,
	type ValidComponent,
} from "@solidjs/web";
import { omit } from "solid-js";
import { Button } from "./button";
import {
	dialogFinalFocus,
	dialogInitialFocus,
	type DialogFocusHandlers,
} from "./dialog";
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import { cn } from "./utils/cn";

type ClassProps<T> = Omit<T, "class"> & { class?: string | undefined };

const AlertDialogContext =
	createContext<ReturnType<typeof createAlertDialogController>>();

function AlertDialog(props: ComponentProps<typeof AlertDialogPrimitiveRoot>) {
	const controller = props.controller ?? createAlertDialogController();
	return (
		<AlertDialogContext value={controller}>
			<AlertDialogPrimitiveRoot {...props} controller={controller} />
		</AlertDialogContext>
	);
}

function AlertDialogTrigger<Tag extends ValidComponent = "button">(
	props: PolymorphicProps<
		Tag,
		ComponentProps<typeof AlertDialogPrimitiveTrigger>
	>,
) {
	const partProps: ComponentProps<typeof AlertDialogPrimitiveTrigger> & {
		as?: Tag;
	} = props;
	return (
		<AlertDialogPrimitiveTrigger
			{...omit(partProps, "as")}
			render={props.as ? renderAs(() => props.as) : props.render}
		/>
	);
}

const AlertDialogPortal = Portal;

const AlertDialogOverlay: Component<
	ClassProps<ComponentProps<typeof AlertDialogPrimitiveOverlay>>
> = (props) => {
	const rest = omit(props, "class");
	return (
		<AlertDialogPrimitiveOverlay
			class={cn(
				"fixed inset-0 z-50 bg-background/80 motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0",
				props.class,
			)}
			{...rest}
		/>
	);
};

const AlertDialogContent: Component<
	ClassProps<
		Omit<ComponentProps<typeof AlertDialogPrimitiveContent>, "children">
	> &
		DialogFocusHandlers & { children?: JSX.Element }
> = (props) => {
	const rest = omit(
		props,
		"class",
		"children",
		"onOpenAutoFocus",
		"onCloseAutoFocus",
		"initialFocus",
		"finalFocus",
	);
	return (
		<>
			<AlertDialogOverlay />
			<AlertDialogPrimitiveContent
				initialFocus={dialogInitialFocus(
					props.onOpenAutoFocus,
					props.initialFocus,
				)}
				finalFocus={dialogFinalFocus(props.onCloseAutoFocus, props.finalFocus)}
				class={cn(
					"fixed top-1/2 left-1/2 z-50 grid max-h-dialog-safe w-dialog-inset max-w-lg -translate-x-1/2 -translate-y-1/2 origin-center gap-4 overflow-y-auto overscroll-contain scrollbar-stable rounded-lg border bg-background p-6 shadow-lg duration-200 motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[open]:zoom-in-95 sm:max-h-dialog-safe",
					props.class,
				)}
				{...rest}
			>
				{props.children}
			</AlertDialogPrimitiveContent>
		</>
	);
};

const AlertDialogHeader: Component<ComponentProps<"div">> = (props) => {
	const rest = omit(props, "class");
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
	const rest = omit(props, "class");
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
	const rest = omit(props, "class");
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
	const rest = omit(props, "class");
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
	const context = useContext(AlertDialogContext);
	const rest = omit(props, "onClick");
	return (
		<Button
			onClick={(event: AlertDialogButtonClickEvent) => {
				invokeButtonClick(props.onClick, event);
				if (!event.defaultPrevented) {
					void context.close();
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
	const rest = omit(props, "class", "variant");
	return (
		<AlertDialogButton
			class={cn("mt-2 sm:mt-0", props.class)}
			variant={props.variant ?? "outline"}
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
