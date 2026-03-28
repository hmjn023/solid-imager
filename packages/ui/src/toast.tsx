import { createSignal, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";

// Types for toast
interface ToastOptions {
	duration?: number;
	dismissible?: boolean;
	onDismiss?: (t: any) => void;
	onAutoClose?: (t: any) => void;
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
	promise: (p: any) => p,
	custom: noop,
	message: noop,
};

let toastImpl: any = mockToast;

if (!isServer) {
	import("solid-sonner").then((m) => {
		toastImpl = m.toast;
	});
}

export const toast = {
	error: (msg: string, opts?: ToastOptions) => toastImpl.error(msg, opts),
	success: (msg: string, opts?: ToastOptions) => toastImpl.success(msg, opts),
	info: (msg: string, opts?: ToastOptions) => toastImpl.info(msg, opts),
	warning: (msg: string, opts?: ToastOptions) => toastImpl.warning(msg, opts),
	loading: (msg: string, opts?: ToastOptions) => toastImpl.loading(msg, opts),
	dismiss: (id?: string | number) => toastImpl.dismiss(id),
	promise: (p: Promise<any>, opts?: any) => toastImpl.promise(p, opts),
	custom: (jsx: any, opts?: ToastOptions) => toastImpl.custom(jsx, opts),
	message: (msg: string, opts?: ToastOptions) => toastImpl.message(msg, opts),
};

export const Toaster = () => {
	const [Comp, setComp] = createSignal<any>(null);

	onMount(() => {
		import("solid-sonner").then((m) => {
			setComp(() => m.Toaster);
		});
	});

	return (
		<Show when={Comp()}>
			{(C) => {
				const Component = C();
				return <Component position="top-right" />;
			}}
		</Show>
	);
};
