import {
	CloseButton as DialogPrimitiveCloseButton,
	Content as DialogPrimitiveContent,
	Description as DialogPrimitiveDescription,
	Overlay as DialogPrimitiveOverlay,
	Portal as DialogPrimitivePortal,
	Root as DialogPrimitiveRoot,
	Title as DialogPrimitiveTitle,
	Trigger as DialogPrimitiveTrigger,
} from "@kobalte/core/dialog";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { Component, ComponentProps, JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/presentation/utils/cn";

const Dialog = DialogPrimitiveRoot;
const DialogTrigger = DialogPrimitiveTrigger;

const DialogPortal: Component<ComponentProps<typeof DialogPrimitivePortal>> = (
	props,
) => {
	const [, rest] = splitProps(props, ["children"]);
	return (
		<DialogPrimitivePortal {...rest}>
			<div class="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
				{props.children}
			</div>
		</DialogPrimitivePortal>
	);
};

type DialogOverlayProps<_T extends ValidComponent = "div"> = ComponentProps<
	typeof DialogPrimitiveOverlay
> & { class?: string | undefined };

const DialogOverlay = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, DialogOverlayProps<T>>,
) => {
	const [, rest] = splitProps(props as DialogOverlayProps, ["class"]);
	return (
		<DialogPrimitiveOverlay
			class={cn(
				"data-[closed]:fade-out-0 data-[expanded]:fade-in-0 fixed inset-0 z-50 bg-background/80 data-[closed]:animate-out data-[expanded]:animate-in",
				props.class,
			)}
			{...rest}
		/>
	);
};

type DialogContentProps<_T extends ValidComponent = "div"> = ComponentProps<
	typeof DialogPrimitiveContent
> & {
	class?: string | undefined;
	children?: JSX.Element;
};

const DialogContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, DialogContentProps<T>>,
) => {
	const [, rest] = splitProps(props as DialogContentProps, [
		"class",
		"children",
	]);
	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitiveContent
				class={cn(
					"-translate-x-1/2 -translate-y-1/2 data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%] fixed top-1/2 left-1/2 z-50 grid max-h-screen w-full max-w-lg gap-4 overflow-y-auto border bg-background p-6 shadow-lg duration-200 data-[closed]:animate-out data-[expanded]:animate-in sm:rounded-lg",
					props.class,
				)}
				{...rest}
			>
				{props.children}
				<DialogPrimitiveCloseButton class="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[expanded]:bg-accent data-[expanded]:text-muted-foreground">
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
						<title>Close</title>
						<path d="M18 6l-12 12" />
						<path d="M6 6l12 12" />
					</svg>
					<span class="sr-only">Close</span>
				</DialogPrimitiveCloseButton>
			</DialogPrimitiveContent>
		</DialogPortal>
	);
};

const DialogHeader: Component<ComponentProps<"div">> = (props) => {
	const [, rest] = splitProps(props, ["class"]);
	return (
		<div
			class={cn(
				"flex flex-col space-y-1.5 text-center sm:text-left",
				props.class,
			)}
			{...rest}
		/>
	);
};

const DialogFooter: Component<ComponentProps<"div">> = (props) => {
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

type DialogTitleProps<_T extends ValidComponent = "h2"> = ComponentProps<
	typeof DialogPrimitiveTitle
> & {
	class?: string | undefined;
};

const DialogTitle = <T extends ValidComponent = "h2">(
	props: PolymorphicProps<T, DialogTitleProps<T>>,
) => {
	const [, rest] = splitProps(props as DialogTitleProps, ["class"]);
	return (
		<DialogPrimitiveTitle
			class={cn(
				"font-semibold text-lg leading-none tracking-tight",
				props.class,
			)}
			{...rest}
		/>
	);
};

type DialogDescriptionProps<_T extends ValidComponent = "p"> = ComponentProps<
	typeof DialogPrimitiveDescription
> & {
	class?: string | undefined;
};

const DialogDescription = <T extends ValidComponent = "p">(
	props: PolymorphicProps<T, DialogDescriptionProps<T>>,
) => {
	const [, rest] = splitProps(props as DialogDescriptionProps, ["class"]);
	return (
		<DialogPrimitiveDescription
			class={cn("text-muted-foreground text-sm", props.class)}
			{...rest}
		/>
	);
};

export {
	Dialog,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
};
