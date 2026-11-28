// Adapted from the Solid UI v2 toast registry recipe.
import CircleCheck from "@lucide/solid/icons/circle-check";
import CircleX from "@lucide/solid/icons/circle-x";
import Info from "@lucide/solid/icons/info";
import LoaderCircle from "@lucide/solid/icons/loader-circle";
import X from "@lucide/solid/icons/x";
import { t } from "@solid-imager/i18n";
import { isServer } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import {
	createToaster,
	Toast,
	ToastAction,
	ToastClose,
	ToastDescription,
	ToastRegion,
	ToastTitle,
	type ToastDismissDetails,
	type ToastOptions as SdkToastOptions,
	type ToastType,
} from "@ui-sdk/solid/toast";
import { createSignal, Match, onSettled, Show, Switch } from "solid-js";
import { Button } from "./button";

type ToastButton = {
	label: string;
	onClick: (event: MouseEvent) => void;
};

interface ToastOptions {
	duration?: number;
	dismissible?: boolean;
	onDismiss?: (details: ToastDismissDetails) => void;
	onAutoClose?: (details: ToastDismissDetails) => void;
	id?: string | number;
	important?: boolean;
	action?: ToastButton;
	cancel?: ToastButton;
	description?: string;
}

const DURATIONS = {
	default: 4000,
	error: 9000,
	info: 7000,
	loading: Infinity,
	success: 4000,
	warning: 8000,
} satisfies Record<ToastType, number>;
const notificationQueue = createToaster();

function withOptions(options?: ToastOptions): SdkToastOptions<JSX.Element> {
	const {
		action,
		cancel,
		dismissible,
		important,
		id,
		onDismiss,
		onAutoClose,
		duration,
		description,
	} = options ?? {};
	return {
		id: id === undefined ? undefined : String(id),
		duration,
		description,
		dismissible,
		priority: important ? "assertive" : undefined,
		action: action && {
			label: action.label,
			onAction: (event) => {
				if (event instanceof MouseEvent) action.onClick(event);
			},
		},
		cancel: cancel && {
			label: cancel.label,
			onCancel: (event) => {
				if (event instanceof MouseEvent) cancel.onClick(event);
			},
		},
		onDismiss: (details) => {
			if (details.reason === "action" && details.event?.defaultPrevented) {
				details.cancel();
				return;
			}
			if (details.reason === "timeout") onAutoClose?.(details);
			else onDismiss?.(details);
		},
	};
}

function notify(type: ToastType, title: JSX.Element, options?: ToastOptions) {
	if (isServer) return "";
	return notificationQueue({
		...withOptions(options),
		title,
		type,
		duration: options?.duration ?? DURATIONS[type],
		dismissible: type !== "loading" && options?.dismissible !== false,
	});
}

export const toast = {
	error: (msg: string, options?: ToastOptions) => notify("error", msg, options),
	success: (msg: string, options?: ToastOptions) =>
		notify("success", msg, options),
	info: (msg: string, options?: ToastOptions) => notify("info", msg, options),
	warning: (msg: string, options?: ToastOptions) =>
		notify("warning", msg, options),
	loading: (msg: string, options?: ToastOptions) =>
		notify("loading", msg, options),
	message: (msg: string, options?: ToastOptions) =>
		notify("default", msg, options),
	dismiss: (id?: string | number) => {
		if (!isServer)
			notificationQueue.dismiss(id === undefined ? undefined : String(id));
	},
	promise: <T,>(
		promise: Promise<T>,
		messages: Parameters<typeof notificationQueue.promise<T>>[1],
		options?: SdkToastOptions<JSX.Element>,
	) => (isServer ? "" : notificationQueue.promise(promise, messages, options)),
};

function ToastIcon(props: { type: ToastType }) {
	return (
		<Switch>
			<Match when={props.type === "success"}>
				<CircleCheck aria-hidden="true" class="size-4 shrink-0" />
			</Match>
			<Match when={props.type === "error"}>
				<CircleX aria-hidden="true" class="size-4 shrink-0" />
			</Match>
			<Match when={props.type === "warning"}>
				<Info
					aria-hidden="true"
					class="size-4 shrink-0 text-warning-foreground"
				/>
			</Match>
			<Match when={props.type === "info"}>
				<Info aria-hidden="true" class="size-4 shrink-0" />
			</Match>
			<Match when={props.type === "loading"}>
				<LoaderCircle
					aria-hidden="true"
					class="size-4 shrink-0 motion-safe:animate-spin"
				/>
			</Match>
		</Switch>
	);
}

export function Toaster() {
	const [mounted, setMounted] = createSignal(false);
	onSettled(() => {
		setMounted(true);
	});
	return (
		<Show when={mounted()}>
			<ToastRegion
				align="end"
				aria-label={t("toast.notifications")}
				class="workspace-theme toast-notifications fixed end-3 top-3 z-100 w-[min(22.25rem,calc(100vw-1.5rem))] outline-none sm:end-5 sm:top-5"
				maxVisible={4}
				shortcut="alt+t"
				side="top"
				toaster={notificationQueue}
			>
				{(item) => (
					<Toast class="toast-notification absolute inset-x-0 top-0 flex items-start gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
						<div class="mt-0.5 empty:hidden">
							<ToastIcon type={item.type} />
						</div>
						<div class="min-w-0 flex-1">
							<ToastTitle class="wrap-anywhere font-medium text-sm" />
							<ToastDescription class="wrap-anywhere text-muted-foreground text-sm" />
							<div class="mt-2 flex flex-wrap gap-2 empty:hidden">
								<ToastAction
									render={(part) => <Button {...part} size="sm" />}
								/>
								<Show when={item.cancel}>
									{(cancel) => (
										<ToastClose
											action={cancel().onCancel}
											render={(part) => (
												<Button {...part} size="sm" variant="outline" />
											)}
										>
											{cancel().label}
										</ToastClose>
									)}
								</Show>
							</div>
						</div>
						<Show when={item.dismissible !== false}>
							<ToastClose
								aria-label={t("toast.closeNotification")}
								class="-mt-1 -me-1 size-11 shrink-0 text-muted-foreground sm:size-7"
								render={(part) => (
									<Button {...part} size="icon" variant="ghost" />
								)}
							>
								<X aria-hidden="true" class="size-4" />
							</ToastClose>
						</Show>
					</Toast>
				)}
			</ToastRegion>
		</Show>
	);
}
