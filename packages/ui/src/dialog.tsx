import { t } from "@solid-imager/i18n";
import {
	Dialog as DialogPrimitiveRoot,
	DialogBackdrop as DialogPrimitiveOverlay,
	DialogClose as DialogPrimitiveCloseButton,
	DialogContent as DialogPrimitiveContent,
	DialogDescription as DialogPrimitiveDescription,
	DialogTitle as DialogPrimitiveTitle,
	DialogTrigger as DialogPrimitiveTrigger,
	createDialogController,
	type DialogInitialFocus,
	type DialogFinalFocus,
	type DialogOpenChangeReason,
} from "@ui-sdk/solid/dialog";
import { createContext, useContext, type Component } from "solid-js";
import type { ComponentProps, JSX, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";

export type DialogDismissHandlers = {
	onEscapeKeyDown?: (event: KeyboardEvent) => void;
	onPointerDownOutside?: (event: PointerEvent) => void;
};

type DialogContextValue = {
	controller: ReturnType<typeof createDialogController>;
	dismiss: DialogDismissHandlers | undefined;
};

const DialogContext = createContext<DialogContextValue>();

export function useDialogContext() {
	return useContext(DialogContext).controller;
}

export function useDialogDismissHandlers(handlers: DialogDismissHandlers) {
	useContext(DialogContext).dismiss = handlers;
}

export type DialogFocusHandlers = {
	onOpenAutoFocus?: (event: Event) => void;
	onCloseAutoFocus?: (event: Event) => void;
};

export function dialogInitialFocus(
	handler: DialogFocusHandlers["onOpenAutoFocus"],
	fallback: DialogInitialFocus | undefined,
): DialogInitialFocus | undefined {
	if (!handler) return fallback;
	return () => {
		const event = new Event("focus", { cancelable: true });
		handler(event);
		return event.defaultPrevented &&
			document.activeElement instanceof HTMLElement
			? document.activeElement
			: undefined;
	};
}

export function dialogFinalFocus(
	handler: DialogFocusHandlers["onCloseAutoFocus"],
	fallback: DialogFinalFocus | undefined,
): DialogFinalFocus | undefined {
	if (!handler) return fallback;
	return () => {
		const prior = document.activeElement;
		const event = new Event("focus", { cancelable: true });
		handler(event);
		if (event.defaultPrevented || document.activeElement !== prior) {
			return document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;
		}
		return undefined;
	};
}

function runDismissHandler(
	handlers: DialogDismissHandlers | undefined,
	reason: DialogOpenChangeReason,
	event: Event,
) {
	if (
		reason === "escape-key" &&
		handlers?.onEscapeKeyDown &&
		event instanceof KeyboardEvent
	) {
		const dismissal = new KeyboardEvent(event.type, {
			key: event.key,
			code: event.code,
			cancelable: true,
		});
		handlers.onEscapeKeyDown(dismissal);
		return dismissal.defaultPrevented;
	}
	if (
		reason === "outside-press" &&
		handlers?.onPointerDownOutside &&
		event instanceof PointerEvent
	) {
		const dismissal = new PointerEvent(event.type, {
			button: event.button,
			clientX: event.clientX,
			clientY: event.clientY,
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			cancelable: true,
		});
		handlers.onPointerDownOutside(dismissal);
		return dismissal.defaultPrevented;
	}
	return false;
}

function Dialog(props: ComponentProps<typeof DialogPrimitiveRoot>) {
	const context: DialogContextValue = {
		controller: props.controller ?? createDialogController(),
		dismiss: undefined,
	};
	return (
		<DialogContext value={context}>
			<DialogPrimitiveRoot
				{...props}
				controller={context.controller}
				onOpenChange={(open, details) => {
					const event = details.event;
					if (
						!open &&
						event &&
						runDismissHandler(context.dismiss, details.reason, event)
					) {
						details.cancel();
						return;
					}
					props.onOpenChange?.(open, details);
				}}
			/>
		</DialogContext>
	);
}

function DialogTrigger<Tag extends ValidComponent = "button">(
	props: PolymorphicProps<Tag, ComponentProps<typeof DialogPrimitiveTrigger>>,
) {
	const partProps: ComponentProps<typeof DialogPrimitiveTrigger> & {
		as?: Tag;
	} = props;
	return (
		<DialogPrimitiveTrigger
			{...omit(partProps, "as")}
			render={props.as ? renderAs(() => props.as) : props.render}
		/>
	);
}

type DialogOverlayProps = Omit<
	ComponentProps<typeof DialogPrimitiveOverlay>,
	"class"
> & { class?: string | undefined };

const DialogOverlay = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, DialogOverlayProps>,
) => {
	const rest = omit(props as DialogOverlayProps, "class");
	return (
		<DialogPrimitiveOverlay
			class={cn(
				"fixed inset-0 z-50 bg-background/80 motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0",
				props.class,
			)}
			{...rest}
		/>
	);
};

type DialogContentProps = Omit<
	ComponentProps<typeof DialogPrimitiveContent>,
	"class" | "children"
> &
	DialogFocusHandlers &
	DialogDismissHandlers & {
		class?: string | undefined;
		children?: JSX.Element;
		placement?: "center" | "left" | "right";
		closeDisabled?: boolean;
		animateOnClose?: boolean;
	};

const DialogContent = (props: DialogContentProps) => {
	useDialogDismissHandlers(props);
	const rest = omit(
		props as DialogContentProps,
		"class",
		"children",
		"placement",
		"closeDisabled",
		"animateOnClose",
		"onOpenAutoFocus",
		"onCloseAutoFocus",
		"onEscapeKeyDown",
		"onPointerDownOutside",
		"initialFocus",
		"finalFocus",
	);
	const placement = () => props.placement ?? "center";
	const padded = () => {
		if (/(?:^|\s)p-0(?:\s|$)|(?:^|\s)py-0(?:\s|$)/.test(props.class ?? "")) {
			return undefined;
		}
		return placement() === "left" ? "sm" : "md";
	};
	return (
		<>
			<DialogOverlay
				class={
					props.animateOnClose === false
						? "motion-safe:data-[closed]:animate-none!"
						: undefined
				}
			/>
			<DialogPrimitiveContent
				initialFocus={dialogInitialFocus(
					props.onOpenAutoFocus,
					props.initialFocus,
				)}
				finalFocus={dialogFinalFocus(props.onCloseAutoFocus, props.finalFocus)}
				data-padded={padded()}
				class={cn(
					"group/dialog fixed z-50 grid overflow-y-auto overscroll-contain scrollbar-stable border bg-background shadow-lg duration-200 motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in",
					placement() === "center"
						? "top-1/2 left-1/2 max-h-dialog-safe w-dialog-inset max-w-lg -translate-x-1/2 -translate-y-1/2 origin-center gap-4 rounded-lg p-6 motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[open]:zoom-in-95 sm:max-h-dialog-safe"
						: placement() === "left"
							? "inset-y-0 left-0 h-dvh max-h-none w-popover-medium max-w-none translate-x-0 translate-y-0 origin-left gap-4 rounded-none border-y-0 border-l-0 p-4 motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0 motion-safe:data-[closed]:slide-out-to-left motion-safe:data-[open]:slide-in-from-left sm:max-h-none"
							: "inset-y-0 right-0 left-auto h-dvh max-h-none w-popover-narrow max-w-none translate-x-0 translate-y-0 origin-right gap-4 rounded-none border-y-0 border-r-0 p-6 motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0 motion-safe:data-[closed]:slide-out-to-right motion-safe:data-[open]:slide-in-from-right sm:max-h-none",
					props.animateOnClose === false &&
						"motion-safe:data-[closed]:animate-none!",
					props.class,
				)}
				{...rest}
			>
				{props.children}
				<DialogPrimitiveCloseButton
					aria-label={t("actions.close")}
					disabled={props.closeDisabled}
					class="absolute top-2.5 right-2.5 z-20 grid size-11 place-items-center rounded-sm text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none sm:size-8"
				>
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
						<title>{t("actions.close")}</title>
						<path d="M18 6l-12 12" />
						<path d="M6 6l12 12" />
					</svg>
					<span class="sr-only">{t("actions.close")}</span>
				</DialogPrimitiveCloseButton>
			</DialogPrimitiveContent>
		</>
	);
};

const DialogHeader: Component<ComponentProps<"div">> = (props) => {
	const rest = omit(props, "class");
	return (
		<div
			class={cn(
				"sticky top-0 z-10 shrink-0 space-y-1.5 bg-background pr-12 text-center group-data-[padded=md]/dialog:-mt-6 group-data-[padded=md]/dialog:pt-6 group-data-[padded=sm]/dialog:-mt-4 group-data-[padded=sm]/dialog:pt-4 sm:text-left",
				props.class,
			)}
			{...rest}
		/>
	);
};

const DialogFooter: Component<ComponentProps<"div">> = (props) => {
	const rest = omit(props, "class");
	return (
		<div
			class={cn(
				"sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-2 bg-background group-data-[padded=md]/dialog:-mb-6 group-data-[padded=md]/dialog:pb-6 group-data-[padded=sm]/dialog:-mb-4 group-data-[padded=sm]/dialog:pb-4 sm:flex-row sm:justify-end [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:w-auto",
				props.class,
			)}
			{...rest}
		/>
	);
};

type DialogTitleProps = Omit<
	ComponentProps<typeof DialogPrimitiveTitle>,
	"class"
> & {
	class?: string | undefined;
};

const DialogTitle = <T extends ValidComponent = "h2">(
	props: PolymorphicProps<T, DialogTitleProps>,
) => {
	const rest = omit(props as DialogTitleProps, "class");
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

type DialogDescriptionProps = Omit<
	ComponentProps<typeof DialogPrimitiveDescription>,
	"class"
> & {
	class?: string | undefined;
};

const DialogDescription = <T extends ValidComponent = "p">(
	props: PolymorphicProps<T, DialogDescriptionProps>,
) => {
	const rest = omit(props as DialogDescriptionProps, "class");
	return (
		<DialogPrimitiveDescription
			class={cn("text-muted-foreground text-sm", props.class)}
			{...rest}
		/>
	);
};

export {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogPrimitiveCloseButton as DialogClose,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
};
