import { createComponent, createSignal, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import type { ToastOptions } from "solid-toast";

// Use a loose type for dynamic module integration
type SolidToastFunction = {
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  (message: any, options?: ToastOptions): string;
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  success(message: any, options?: ToastOptions): string;
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  error(message: any, options?: ToastOptions): string;
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  loading(message: any, options?: ToastOptions): string;
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  promise(promise: Promise<any>, msgs: any, options?: ToastOptions): string;
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  custom(jsx: any, options?: ToastOptions): string;
  dismiss(id?: string): void;
  remove(id?: string): void;
};

let solidToast: SolidToastFunction | null = null;

export const Toaster = (props: Record<string, unknown>) => {
  if (isServer) {
    return null;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic SolidJS component type
  const [ToasterComponent, setToasterComponent] = createSignal<any>(null);

  onMount(() => {
    import("solid-toast").then((module) => {
      solidToast = module.toast as SolidToastFunction;
      setToasterComponent(() => module.Toaster);
    });
  });

  return (
    <Show when={ToasterComponent()}>
      {(Comp) => createComponent(Comp(), props)}
    </Show>
  );
};

const RANDOM_RADIX = 36;
const ID_START_INDEX = 2;
const ID_END_INDEX = 9;

const generateId = () =>
  Math.random().toString(RANDOM_RADIX).substring(ID_START_INDEX, ID_END_INDEX);

// biome-ignore lint/suspicious/noExplicitAny: Argument type matching library
export const toast = (...args: [any, ToastOptions?]) => {
  if (isServer) {
    return "";
  }

  if (solidToast) {
    return solidToast(...args);
  }

  const id = args[1]?.id || generateId();
  const options = { ...args[1], id };
  // biome-ignore lint/suspicious/noExplicitAny: Argument type matching library
  const newArgs: [any, ToastOptions?] = [args[0], options];

  import("solid-toast").then((module) => {
    solidToast = module.toast as SolidToastFunction;
    solidToast(...newArgs);
  });

  return id;
};

const createProxyMethod = (method: keyof SolidToastFunction) => {
  // biome-ignore lint/suspicious/noExplicitAny: Arguments forwarded dynamically
  return (...args: any[]) => {
    if (isServer) {
      return "";
    }

    // @ts-expect-error - dynamic method invocation
    if (solidToast?.[method]) {
      // @ts-expect-error - dynamic method invocation
      return solidToast[method](...args);
    }

    const id = args[1]?.id || generateId();
    const options = { ...args[1], id };
    const newArgs = [args[0], options];

    import("solid-toast").then((module) => {
      solidToast = module.toast as SolidToastFunction;
      // @ts-expect-error - dynamic method invocation
      if (solidToast?.[method]) {
        // @ts-expect-error - dynamic method invocation
        solidToast[method](...newArgs);
      }
    });

    return id;
  };
};

toast.success = createProxyMethod("success");
toast.error = createProxyMethod("error");
toast.loading = createProxyMethod("loading");
toast.promise = createProxyMethod("promise");
toast.custom = createProxyMethod("custom");

toast.dismiss = (...args: [string?]) => {
  if (isServer) {
    return;
  }
  if (solidToast) {
    solidToast.dismiss(...args);
    return;
  }
  import("solid-toast").then((module) => {
    solidToast = module.toast as SolidToastFunction;
    solidToast.dismiss(...args);
  });
};

toast.remove = (...args: [string?]) => {
  if (isServer) {
    return;
  }
  if (solidToast) {
    solidToast.remove(...args);
    return;
  }
  import("solid-toast").then((module) => {
    solidToast = module.toast as SolidToastFunction;
    solidToast.remove(...args);
  });
};

export default toast;
