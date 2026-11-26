import { t } from "@solid-imager/i18n";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import type {
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

function dispatchToast(
	call: (impl: typeof SonnerToast) => void,
): string | number {
	const impl = activeToast();
	if (impl) {
		call(impl);
		return "";
	}
	if (pendingToastCalls.length < MAX_QUEUED_TOASTS) {
		pendingToastCalls.push(call);
	}
	return "";
}

function withDefaultDuration(
	opts: ToastOptions | undefined,
	defaultDuration: number,
): ToastOptions {
	return opts?.duration !== undefined
		? opts
		: { ...opts, duration: defaultDuration };
}

if (!isServer) {
	void import("solid-sonner").then((m) => {
		sonnerToastModule = m.toast;
		flushPendingToasts();
	});
}

export const toast = {
	error: (msg: string, opts?: ToastOptions) => {
		const options = withDefaultDuration(opts, DURATION_BY_SEVERITY.error);
		const impl = activeToast();
		return impl
			? impl.error(
					msg,
					options as unknown as Parameters<typeof SonnerToast.error>[1],
				)
			: dispatchToast((readyImpl) =>
					readyImpl.error(
						msg,
						options as unknown as Parameters<typeof SonnerToast.error>[1],
					),
				);
	},
	success: (msg: string, opts?: ToastOptions) => {
		const options = withDefaultDuration(opts, DURATION_BY_SEVERITY.success);
		const impl = activeToast();
		return impl
			? impl.success(
					msg,
					options as unknown as Parameters<typeof SonnerToast.success>[1],
				)
			: dispatchToast((readyImpl) =>
					readyImpl.success(
						msg,
						options as unknown as Parameters<typeof SonnerToast.success>[1],
					),
				);
	},
	info: (msg: string, opts?: ToastOptions) => {
		const options = withDefaultDuration(opts, DURATION_BY_SEVERITY.info);
		const impl = activeToast();
		return impl
			? impl.info(
					msg,
					options as unknown as Parameters<typeof SonnerToast.info>[1],
				)
			: dispatchToast((readyImpl) =>
					readyImpl.info(
						msg,
						options as unknown as Parameters<typeof SonnerToast.info>[1],
					),
				);
	},
	warning: (msg: string, opts?: ToastOptions) => {
		const options = withDefaultDuration(opts, DURATION_BY_SEVERITY.warning);
		const impl = activeToast();
		return impl
			? impl.warning(
					msg,
					options as unknown as Parameters<typeof SonnerToast.warning>[1],
				)
			: dispatchToast((readyImpl) =>
					readyImpl.warning(
						msg,
						options as unknown as Parameters<typeof SonnerToast.warning>[1],
					),
				);
	},
	loading: (msg: string, opts?: ToastOptions) => {
		const impl = activeToast();
		return impl
			? impl.loading(
					msg,
					opts as unknown as Parameters<typeof SonnerToast.loading>[1],
				)
			: dispatchToast((readyImpl) =>
					readyImpl.loading(
						msg,
						opts as unknown as Parameters<typeof SonnerToast.loading>[1],
					),
				);
	},
	dismiss: (id?: string | number) => {
		const impl = activeToast();
		if (impl) {
			return impl.dismiss(id);
		}
		return dispatchToast((readyImpl) => readyImpl.dismiss(id));
	},
	promise: <T,>(
		p: Promise<T>,
		opts?: Parameters<typeof SonnerToast.promise>[1],
	) => {
		const impl = activeToast();
		if (impl) {
			return impl.promise(p, opts);
		}
		dispatchToast((readyImpl) => {
			void readyImpl.promise(p, opts);
		});
		return p;
	},
	custom: (jsx: unknown, opts?: ToastOptions) => {
		const impl = activeToast();
		return impl
			? impl.custom(
					jsx as Parameters<typeof SonnerToast.custom>[0],
					opts as unknown as Parameters<typeof SonnerToast.custom>[1],
				)
			: dispatchToast((readyImpl) =>
					readyImpl.custom(
						jsx as Parameters<typeof SonnerToast.custom>[0],
						opts as unknown as Parameters<typeof SonnerToast.custom>[1],
					),
				);
	},
	message: (msg: string, opts?: ToastOptions) => {
		const options = withDefaultDuration(opts, DURATION_BY_SEVERITY.message);
		const impl = activeToast();
		return impl
			? impl.message(
					msg,
					options as unknown as Parameters<typeof SonnerToast.message>[1],
				)
			: dispatchToast((readyImpl) =>
					readyImpl.message(
						msg,
						options as unknown as Parameters<typeof SonnerToast.message>[1],
					),
				);
	},
};

function ToasterReadyNotifier() {
	onMount(() => {
		queueMicrotask(() => {
			toasterMounted = true;
			flushPendingToasts();
		});
	});
	onCleanup(() => {
		toasterMounted = false;
	});
	return null;
}

export const Toaster = () => {
	const [Comp, setComp] = createSignal<typeof SonnerToaster | null>(null);

	onMount(() => {
		void import("solid-sonner").then((m) => {
			sonnerToastModule = m.toast;
			setComp(() => m.Toaster);
		});
	});

	return (
		<Show when={Comp()}>
			{(ToasterComp) => {
				const C = ToasterComp();
				return (
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
				);
			}}
		</Show>
	);
};
