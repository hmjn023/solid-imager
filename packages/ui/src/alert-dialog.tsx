// Adapted from the Solid UI v2 alert-dialog registry recipe.
import {
	AlertDialogBackdrop as SdkAlertDialogBackdrop,
	AlertDialogClose as SdkAlertDialogClose,
	AlertDialogContent as SdkAlertDialogContent,
	AlertDialogDescription as SdkAlertDialogDescription,
	AlertDialogTitle as SdkAlertDialogTitle,
	AlertDialog as SdkAlertDialog,
	AlertDialogTrigger as SdkAlertDialogTrigger,
} from "@ui-sdk/solid/alert-dialog";
import { omit, type Component } from "solid-js";
import {
	Portal,
	type ComponentProps,
	type JSX,
	type ValidComponent,
} from "@solidjs/web";
import { Button, type ButtonProps } from "./button";
import {
	dialogFinalFocus,
	dialogInitialFocus,
	type DialogFocusHandlers,
} from "./dialog";
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import { cn } from "./utils/cn";

type ClassProps<T> = Omit<T, "class"> & { class?: string | undefined };

const AlertDialog = (props: ComponentProps<typeof SdkAlertDialog>) => (
	<SdkAlertDialog {...props} />
);

function AlertDialogTrigger<Tag extends ValidComponent = "button">(
	props: PolymorphicProps<Tag, ComponentProps<typeof SdkAlertDialogTrigger>>,
) {
	const partProps: ComponentProps<typeof SdkAlertDialogTrigger> & {
		as?: Tag;
	} = props;
	return (
		<SdkAlertDialogTrigger
			{...omit(partProps, "as")}
			render={props.as ? renderAs(() => props.as) : props.render}
		/>
	);
}

const AlertDialogPortal = Portal;

const AlertDialogOverlay: Component<
	ClassProps<ComponentProps<typeof SdkAlertDialogBackdrop>>
> = (props) => {
	const rest = omit(props, "class");
	return (
		<SdkAlertDialogBackdrop
			class={cn(
				"fixed inset-0 isolate z-50 bg-background/80 motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0",
				props.class,
			)}
			{...rest}
		/>
	);
};

const AlertDialogContent: Component<
	ClassProps<Omit<ComponentProps<typeof SdkAlertDialogContent>, "children">> &
		DialogFocusHandlers & { children?: JSX.Element; size?: "default" | "sm" }
> = (props) => {
	const rest = omit(
		props,
		"class",
		"children",
		"onOpenAutoFocus",
		"onCloseAutoFocus",
		"initialFocus",
		"finalFocus",
		"size",
	);
	return (
		<>
			<AlertDialogOverlay />
			<SdkAlertDialogContent
				data-size={props.size ?? "default"}
				initialFocus={dialogInitialFocus(
					props.onOpenAutoFocus,
					props.initialFocus,
				)}
				finalFocus={dialogFinalFocus(props.onCloseAutoFocus, props.finalFocus)}
				class={cn(
					"group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid max-h-dialog-safe w-dialog-inset max-w-lg -translate-x-1/2 -translate-y-1/2 origin-center gap-4 overflow-y-auto overscroll-contain scrollbar-stable rounded-lg border bg-background p-6 shadow-lg duration-200 data-[size=sm]:max-w-sm motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[open]:zoom-in-95 sm:max-h-dialog-safe",
					props.class,
				)}
				{...rest}
			>
				{props.children}
			</SdkAlertDialogContent>
		</>
	);
};

const AlertDialogHeader: Component<ComponentProps<"div">> = (props) => {
	const rest = omit(props, "class");
	return (
		<div
			data-slot="alert-dialog-header"
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
			data-slot="alert-dialog-footer"
			class={cn(
				"sticky bottom-0 z-10 -mb-6 flex shrink-0 flex-col-reverse gap-2 bg-background pb-6 sm:flex-row sm:justify-end [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:w-auto",
				props.class,
			)}
			{...rest}
		/>
	);
};

const AlertDialogMedia: Component<ComponentProps<"div">> = (props) => (
	<div
		data-slot="alert-dialog-media"
		{...omit(props, "class")}
		class={cn(
			"mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted *:[svg:not([class*='size-'])]:size-6",
			props.class,
		)}
	/>
);

const AlertDialogTitle: Component<
	ClassProps<ComponentProps<typeof SdkAlertDialogTitle>>
> = (props) => {
	const rest = omit(props, "class");
	return (
		<SdkAlertDialogTitle
			class={cn("font-semibold text-lg", props.class)}
			{...rest}
		/>
	);
};

const AlertDialogDescription: Component<
	ClassProps<ComponentProps<typeof SdkAlertDialogDescription>>
> = (props) => {
	const rest = omit(props, "class");
	return (
		<SdkAlertDialogDescription
			class={cn("text-muted-foreground text-sm", props.class)}
			{...rest}
		/>
	);
};

type ButtonPresentation = Pick<
	ButtonProps,
	"class" | "size" | "variant" | "aria-busy" | "aria-expanded" | "aria-pressed"
>;
type AlertDialogButtonProps = Omit<
	ComponentProps<typeof SdkAlertDialogClose>,
	keyof ButtonPresentation
> &
	ButtonPresentation;

const AlertDialogButton: Component<AlertDialogButtonProps> = (props) => (
	<SdkAlertDialogClose
		render={(partProps) => (
			<Button
				{...partProps}
				variant={props.variant}
				size={props.size}
				{...(props["aria-busy"] === undefined
					? {}
					: { "aria-busy": props["aria-busy"] })}
				{...(props["aria-expanded"] === undefined
					? {}
					: { "aria-expanded": props["aria-expanded"] })}
				{...(props["aria-pressed"] === undefined
					? {}
					: { "aria-pressed": props["aria-pressed"] })}
			/>
		)}
		{...omit(
			props,
			"variant",
			"size",
			"aria-busy",
			"aria-expanded",
			"aria-pressed",
		)}
	/>
);

const AlertDialogAction: Component<AlertDialogButtonProps> = (props) => (
	<AlertDialogButton value="confirm" {...props} />
);

const AlertDialogCancel: Component<AlertDialogButtonProps> = (props) => {
	const rest = omit(props, "class", "variant");
	return (
		<AlertDialogButton
			value="cancel"
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
	AlertDialogMedia,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger,
};
