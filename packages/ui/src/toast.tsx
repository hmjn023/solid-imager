import { t } from "@solid-imager/i18n";
import { createSignal, onSettled, Show } from "solid-js";
import { isServer } from "@solidjs/web";
import type {
	ExternalToast,
	toast as SonnerToast,
	Toaster as SonnerToaster,
} from "solid-sonner";

// Types for toast
interface ToastOptions {
	duration?: number;
	dismissible?: boolean;
	onDismiss?: (t: unknown) => void;
	onAutoClose?: (t: unknown) => void;
	id?: string | number;
	important?: boolean;
	action?: {
		label: string;
		onClick: (event: MouseEvent) => void;
	};
	cancel?: {
		label: string;
		onClick?: (event: MouseEvent) => void;
	};
	description?: string;
}

const MAX_QUEUED_TOASTS = 20;
const DURATION_BY_SEVERITY = {
	error: 9000,
	info: 7000,
	message: 4000,
	success: 4000,
	warning: 8000,
} as const;

let sonnerToastModule: typeof SonnerToast | null = null;
let toasterMounted = false;
const pendingToastCalls: Array<(impl: typeof SonnerToast) => void> = [];

function flushPendingToasts() {
	if (!toasterMounted || !sonnerToastModule) return;
	for (const call of pendingToastCalls.splice(0)) {
		call(sonnerToastModule);
	}
}

function activeToast(): typeof SonnerToast | null {
	return toasterMounted && sonnerToastModule ? sonnerToastModule : null;
}

function dispatchToast<T>(
	call: (impl: typeof SonnerToast) => T,
): T | undefined {
	const impl = activeToast();
	if (impl) return call(impl);
	if (!isServer && pendingToastCalls.length < MAX_QUEUED_TOASTS) {
		pendingToastCalls.push(call);
	}
	return undefined;
}

function sonnerOptions(
	options: ToastOptions | undefined,
	defaultDuration?: number,
): ExternalToast | undefined {
	if (!options && defaultDuration === undefined) return undefined;
	const { cancel, ...rest } = options ?? {};
	return {
		...rest,
		duration: rest.duration ?? defaultDuration,
		cancel: cancel && {
			label: cancel.label,
			onClick: cancel.onClick ?? (() => {}),
		},
	};
}

if (!isServer) {
	void import("solid-sonner").then((module) => {
		sonnerToastModule = module.toast;
		flushPendingToasts();
	});
}

export const toast = {
	error: (msg: string, opts?: ToastOptions) =>
		dispatchToast((impl) =>
			impl.error(msg, sonnerOptions(opts, DURATION_BY_SEVERITY.error)),
		) ?? "",
	success: (msg: string, opts?: ToastOptions) =>
		dispatchToast((impl) =>
			impl.success(msg, sonnerOptions(opts, DURATION_BY_SEVERITY.success)),
		) ?? "",
	info: (msg: string, opts?: ToastOptions) =>
		dispatchToast((impl) =>
			impl.info(msg, sonnerOptions(opts, DURATION_BY_SEVERITY.info)),
		) ?? "",
	warning: (msg: string, opts?: ToastOptions) =>
		dispatchToast((impl) =>
			impl.warning(msg, sonnerOptions(opts, DURATION_BY_SEVERITY.warning)),
		) ?? "",
	loading: (msg: string, opts?: ToastOptions) =>
		dispatchToast((impl) => impl.loading(msg, sonnerOptions(opts))) ?? "",
	dismiss: (id?: string | number) => dispatchToast((impl) => impl.dismiss(id)),
	promise: <T,>(
		promise: Promise<T>,
		options?: Parameters<typeof SonnerToast.promise<T>>[1],
	) => {
		const impl = activeToast();
		if (impl) return impl.promise(promise, options);
		dispatchToast((readyImpl) => readyImpl.promise(promise, options));
		return promise;
	},
	custom: (
		render: Parameters<typeof SonnerToast.custom>[0],
		opts?: ToastOptions,
	) => dispatchToast((impl) => impl.custom(render, sonnerOptions(opts))) ?? "",
	message: (msg: string, opts?: ToastOptions) =>
		dispatchToast((impl) =>
			impl.message(msg, sonnerOptions(opts, DURATION_BY_SEVERITY.message)),
		) ?? "",
};

function ToasterReadyNotifier() {
	onSettled(() => {
		toasterMounted = true;
		flushPendingToasts();
		return () => {
			toasterMounted = false;
		};
	});
	return null;
}

export const Toaster = () => {
	const [Comp, setComp] = createSignal<typeof SonnerToaster | null>(null);

	onSettled(() => {
		void import("solid-sonner").then((m) => {
			sonnerToastModule = m.toast;
			setComp(() => m.Toaster);
		});
	});

	return (
		<Show keyed when={Comp()}>
			{(C) => (
				<>
					<C
						class="workspace-theme group"
						closeButton
						containerAriaLabel={t("toast.notifications")}
						duration={DURATION_BY_SEVERITY.info}
						gap={10}
						mobileOffset={{ left: 12, right: 12, top: 12 }}
						offset={20}
						position="top-right"
						visibleToasts={4}
						toastOptions={{
							closeButtonAriaLabel: t("toast.closeNotification"),
							classes: {
								actionButton:
									"group-[.toast]:bg-primary group-[.toast]:font-medium group-[.toast]:text-primary-foreground hover:group-[.toast]:bg-primary-hover",
								cancelButton:
									"group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
								closeButton:
									"group-[.toast]:border-border group-[.toast]:bg-background group-[.toast]:text-muted-foreground",
								description: "group-[.toast]:text-muted-foreground",
								toast:
									"group toast border-border bg-popover text-popover-foreground shadow-lg",
							},
						}}
					/>
					<ToasterReadyNotifier />
				</>
			)}
		</Show>
	);
};
