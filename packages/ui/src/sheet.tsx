import { t } from "@solid-imager/i18n";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type { Component } from "solid-js";
import type { ComponentProps, JSX } from "@solidjs/web";
import { DialogContent as SheetPrimitiveContent } from "@ui-sdk/solid/dialog";
import {
	Dialog as Sheet,
	DialogTrigger as SheetTrigger,
	DialogClose as SheetClose,
	DialogOverlay as SheetOverlay,
	DialogTitle as SheetPrimitiveTitle,
	DialogDescription as SheetPrimitiveDescription,
	dialogFinalFocus,
	dialogInitialFocus,
	useDialogDismissHandlers,
	type DialogFocusHandlers,
	type DialogDismissHandlers,
} from "./dialog";
import { omit } from "solid-js";

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
	ComponentProps<typeof SheetPrimitiveContent>,
	"class" | "children"
> &
	DialogFocusHandlers &
	DialogDismissHandlers &
	VariantProps<typeof sheetVariants> & {
		class?: string | undefined;
		children?: JSX.Element;
	};

const SheetContent = (props: DialogContentProps) => {
	useDialogDismissHandlers(props);
	const others = omit(
		props as DialogContentProps,
		"position",
		"class",
		"children",
		"onOpenAutoFocus",
		"onCloseAutoFocus",
		"onEscapeKeyDown",
		"onPointerDownOutside",
		"initialFocus",
		"finalFocus",
	);
	return (
		<>
			<SheetOverlay />
			<SheetPrimitiveContent
				initialFocus={dialogInitialFocus(
					props.onOpenAutoFocus,
					props.initialFocus,
				)}
				finalFocus={dialogFinalFocus(props.onCloseAutoFocus, props.finalFocus)}
				class={cn(
					sheetVariants({ position: props.position }),
					props.class,
					"max-h-dvh overflow-y-auto overscroll-contain",
				)}
				{...others}
			>
				{props.children}
				<SheetClose
					aria-label={t("actions.close")}
					class="absolute top-2.5 right-2.5 z-20 grid size-11 place-items-center rounded-sm text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none sm:size-8"
				>
					<svg
						aria-hidden="true"
						class="size-4"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path d="M18 6l-12 12" />
						<path d="M6 6l12 12" />
					</svg>
					<span class="sr-only">{t("actions.close")}</span>
				</SheetClose>
			</SheetPrimitiveContent>
		</>
	);
};

const SheetHeader: Component<ComponentProps<"div">> = (props) => {
	const others = omit(props, "class");
	return (
		<div
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
			class={cn(
				"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
				props.class,
			)}
			{...others}
		/>
	);
};

type DialogTitleProps = Omit<
	ComponentProps<typeof SheetPrimitiveTitle>,
	"class"
> & {
	class?: string | undefined;
};

const SheetTitle = (props: DialogTitleProps) => {
	const others = omit(props as DialogTitleProps, "class");
	return (
		<SheetPrimitiveTitle
			class={cn("font-semibold text-foreground text-lg", props.class)}
			{...others}
		/>
	);
};

type DialogDescriptionProps = Omit<
	ComponentProps<typeof SheetPrimitiveDescription>,
	"class"
> & { class?: string | undefined };

const SheetDescription = (props: DialogDescriptionProps) => {
	const others = omit(props as DialogDescriptionProps, "class");
	return (
		<SheetPrimitiveDescription
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
