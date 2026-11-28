// Adapted from the Solid UI v2 sheet registry recipe.
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { merge, omit, Show, type Component } from "solid-js";
import type { ComponentProps, JSX } from "@solidjs/web";
import { DialogContent as SdkDialogContent } from "@ui-sdk/solid/dialog";
import {
	Dialog as Sheet,
	DialogTrigger as SheetTrigger,
	DialogClose as SheetClose,
	DialogCloseButton,
	DialogOverlay as SheetOverlay,
	DialogTitle,
	DialogDescription,
	dialogFinalFocus,
	dialogInitialFocus,
	type DialogFocusHandlers,
} from "./dialog";

import { cn } from "./utils/cn";

const sheetVariants = cva(
	"fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out motion-reduce:transition-none motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:duration-300 motion-safe:data-[open]:duration-500",
	{
		variants: {
			position: {
				top: "inset-x-0 top-0 rounded-b-lg border-b motion-safe:data-[closed]:slide-out-to-top motion-safe:data-[open]:slide-in-from-top",
				bottom:
					"inset-x-0 bottom-0 rounded-t-lg border-t motion-safe:data-[closed]:slide-out-to-bottom motion-safe:data-[open]:slide-in-from-bottom",
				left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm motion-safe:data-[closed]:slide-out-to-left motion-safe:data-[open]:slide-in-from-left",
				right:
					"inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm motion-safe:data-[closed]:slide-out-to-right motion-safe:data-[open]:slide-in-from-right",
			},
		},
		defaultVariants: {
			position: "right",
		},
	},
);

type DialogContentProps = Omit<
	ComponentProps<typeof SdkDialogContent>,
	"class" | "children"
> &
	DialogFocusHandlers &
	VariantProps<typeof sheetVariants> & {
		class?: string | undefined;
		children?: JSX.Element;
		side?: "top" | "right" | "bottom" | "left";
		showCloseButton?: boolean;
		"data-slot"?: string;
	};

const SheetContent = (props: DialogContentProps) => {
	const others = omit(
		props as DialogContentProps,
		"position",
		"side",
		"showCloseButton",
		"render",
		"data-slot",
		"class",
		"children",
		"onOpenAutoFocus",
		"onCloseAutoFocus",
		"initialFocus",
		"finalFocus",
	);
	const side = () => props.side ?? props.position ?? "right";
	const renderContent: DialogContentProps["render"] = (part, state) => {
		const attributes = merge(part, () => ({
			"data-slot": props["data-slot"] ?? "sheet-content",
		}));
		return props.render ? (
			props.render(attributes, state)
		) : (
			<div {...attributes} />
		);
	};
	return (
		<>
			<SheetOverlay />
			<SdkDialogContent
				data-side={side()}
				initialFocus={dialogInitialFocus(
					props.onOpenAutoFocus,
					props.initialFocus,
				)}
				finalFocus={dialogFinalFocus(props.onCloseAutoFocus, props.finalFocus)}
				class={cn(
					sheetVariants({ position: side() }),
					props.class,
					"max-h-dvh overflow-y-auto overscroll-contain",
				)}
				{...others}
				render={renderContent}
			>
				{props.children}
				<Show when={props.showCloseButton !== false}>
					<DialogCloseButton />
				</Show>
			</SdkDialogContent>
		</>
	);
};

const SheetHeader: Component<ComponentProps<"div">> = (props) => {
	const others = omit(props, "class");
	return (
		<div
			data-slot="sheet-header"
			class={cn(
				"flex flex-col space-y-2 pr-12 text-center sm:text-left",
				props.class,
			)}
			{...others}
		/>
	);
};

const SheetFooter: Component<ComponentProps<"div">> = (props) => {
	const others = omit(props, "class");
	return (
		<div
			data-slot="sheet-footer"
			class={cn(
				"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
				props.class,
			)}
			{...others}
		/>
	);
};

type DialogTitleProps = Omit<ComponentProps<typeof DialogTitle>, "class"> & {
	class?: string | undefined;
};

const SheetTitle = (props: DialogTitleProps) => {
	const others = omit(props as DialogTitleProps, "class");
	return (
		<DialogTitle
			class={cn("font-semibold text-foreground text-lg", props.class)}
			{...others}
		/>
	);
};

type DialogDescriptionProps = Omit<
	ComponentProps<typeof DialogDescription>,
	"class"
> & { class?: string | undefined };

const SheetDescription = (props: DialogDescriptionProps) => {
	const others = omit(props as DialogDescriptionProps, "class");
	return (
		<DialogDescription
			class={cn("text-muted-foreground text-sm", props.class)}
			{...others}
		/>
	);
};

export {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
};
