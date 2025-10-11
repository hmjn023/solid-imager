import {
	ActionButton as AlertDialogPrimitiveActionButton,
	CancelButton as AlertDialogPrimitiveCancelButton,
	Content as AlertDialogPrimitiveContent,
	Description as AlertDialogPrimitiveDescription,
	Overlay as AlertDialogPrimitiveOverlay,
	Portal as AlertDialogPrimitivePortal,
	Root as AlertDialogPrimitiveRoot,
	Title as AlertDialogPrimitiveTitle,
	Trigger as AlertDialogPrimitiveTrigger,
} from "@kobalte/core/alert-dialog";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { Component, ComponentProps, JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

const AlertDialog = AlertDialogPrimitiveRoot;
const AlertDialogTrigger = AlertDialogPrimitiveTrigger;

const AlertDialogPortal: Component<
	AlertDialogPrimitivePortal.AlertDialogPortalProps
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

type AlertDialogOverlayProps<T extends ValidComponent = "div"> =
	AlertDialogPrimitiveOverlay.AlertDialogOverlayProps<T> & {
		class?: string | undefined;
	};

const AlertDialogOverlay = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, AlertDialogOverlayProps<T>>,
) => {
	const [, rest] = splitProps(props as AlertDialogOverlayProps, ["class"]);
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

type AlertDialogContentProps<T extends ValidComponent = "div"> =
	AlertDialogPrimitiveContent.AlertDialogContentProps<T> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

const AlertDialogContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, AlertDialogContentProps<T>>,
) => {
	const [, rest] = splitProps(props as AlertDialogContentProps, [
		"class",
		"children",
	]);
	return (
		<AlertDialogPrimitivePortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitiveContent
				class={cn(
					"-translate-x-1/2 -translate-y-1/2 data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%] fixed top-1/2 left-1/2 z-50 grid max-h-screen w-full max-w-lg gap-4 overflow-y-auto border bg-background p-6 shadow-lg duration-200 data-[closed]:animate-out data-[expanded]:animate-in sm:rounded-lg",
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
				"flex flex-col space-y-2 text-center sm:text-left",
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
				"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
				props.class,
			)}
			{...rest}
		/>
	);
};

type AlertDialogTitleProps<T extends ValidComponent = "h2"> =
	AlertDialogPrimitiveTitle.AlertDialogTitleProps<T> & {
		class?: string | undefined;
	};

const AlertDialogTitle = <T extends ValidComponent = "h2">(
	props: PolymorphicProps<T, AlertDialogTitleProps<T>>,
) => {
	const [, rest] = splitProps(props as AlertDialogTitleProps, ["class"]);
	return (
		<AlertDialogPrimitiveTitle
			class={cn("font-semibold text-lg", props.class)}
			{...rest}
		/>
	);
};

type AlertDialogDescriptionProps<T extends ValidComponent = "p"> =
	AlertDialogPrimitiveDescription.AlertDialogDescriptionProps<T> & {
		class?: string | undefined;
	};

const AlertDialogDescription = <T extends ValidComponent = "p">(
	props: PolymorphicProps<T, AlertDialogDescriptionProps<T>>,
) => {
	const [, rest] = splitProps(props as AlertDialogDescriptionProps, ["class"]);
	return (
		<AlertDialogPrimitiveDescription
			class={cn("text-muted-foreground text-sm", props.class)}
			{...rest}
		/>
	);
};

type AlertDialogActionProps<T extends ValidComponent = "button"> =
	AlertDialogPrimitiveActionButton.AlertDialogActionButtonProps<T> & {
		class?: string | undefined;
	};

const AlertDialogAction = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, AlertDialogActionProps<T>>,
) => {
	const [, rest] = splitProps(props as AlertDialogActionProps, ["class"]);
	return (
		<AlertDialogPrimitiveActionButton
			class={cn(buttonVariants(), props.class)}
			{...rest}
		/>
	);
};

type AlertDialogCancelProps<T extends ValidComponent = "button"> =
	AlertDialogPrimitiveCancelButton.AlertDialogCancelButtonProps<T> & {
		class?: string | undefined;
	};

const AlertDialogCancel = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, AlertDialogCancelProps<T>>,
) => {
	const [, rest] = splitProps(props as AlertDialogCancelProps, ["class"]);
	return (
		<AlertDialogPrimitiveCancelButton
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
	AlertDialogTrigger,
	AlertDialogPortal,
	AlertDialogOverlay,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogFooter,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogAction,
	AlertDialogCancel,
};
