import { createSignal, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import type { toast as SonnerToast, Toaster as SonnerToaster } from "solid-sonner";

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

const noop = () => "";
const mockToast = {
	error: noop,
	success: noop,
	info: noop,
	warning: noop,
	loading: noop,
	dismiss: noop,
	promise: <T extends unknown>(p: Promise<T>) => p,
	custom: noop,
	message: noop,
} as unknown as typeof SonnerToast;

let toastImpl: typeof SonnerToast = mockToast;

if (!isServer) {
	import("solid-sonner").then((m) => {
		toastImpl = m.toast;
	});
}

export const toast = {
	error: (msg: string, opts?: ToastOptions) => toastImpl.error(msg, opts as unknown as Parameters<typeof SonnerToast.error>[1]),
	success: (msg: string, opts?: ToastOptions) => toastImpl.success(msg, opts as unknown as Parameters<typeof SonnerToast.success>[1]),
	info: (msg: string, opts?: ToastOptions) => toastImpl.info(msg, opts as unknown as Parameters<typeof SonnerToast.info>[1]),
	warning: (msg: string, opts?: ToastOptions) => toastImpl.warning(msg, opts as unknown as Parameters<typeof SonnerToast.warning>[1]),
	loading: (msg: string, opts?: ToastOptions) => toastImpl.loading(msg, opts as unknown as Parameters<typeof SonnerToast.loading>[1]),
	dismiss: (id?: string | number) => toastImpl.dismiss(id),
	promise: <T extends unknown>(p: Promise<T>, opts?: Parameters<typeof SonnerToast.promise>[1]) => toastImpl.promise(p, opts),
	custom: (jsx: unknown, opts?: ToastOptions) => toastImpl.custom(jsx as Parameters<typeof SonnerToast.custom>[0], opts as unknown as Parameters<typeof SonnerToast.custom>[1]),
	message: (msg: string, opts?: ToastOptions) => toastImpl.message(msg, opts as unknown as Parameters<typeof SonnerToast.message>[1]),
};

export const Toaster = () => {
	const [Comp, setComp] = createSignal<typeof SonnerToaster | null>(null);

	onMount(() => {
		import("solid-sonner").then((m) => {
			setComp(() => m.Toaster);
		});
	});

	return (
		<Show when={Comp()}>
			{(ToasterComp) => {
				const C = ToasterComp();
				return <C position="top-right" />;
			}}
		</Show>
	);
};
