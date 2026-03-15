import { createComponent, createSignal, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import type { ToastOptions } from "solid-toast";

// Use a loose type for dynamic module integration
type SolidToastFunction = {
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  (message: any, options?: ToastOptions): any;
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  success(message: any, options?: ToastOptions): any;
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  error(message: any, options?: ToastOptions): any;
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  loading(message: any, options?: ToastOptions): any;
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  promise(promise: Promise<any>, msgs: any, options?: ToastOptions): any;
  // biome-ignore lint/suspicious/noExplicitAny: Required for library typing match
  custom(jsx: any, options?: ToastOptions): any;
  dismiss(id?: string): void;
  remove(id?: string): void;
};

let solidToast: SolidToastFunction | null = null;

const RANDOM_RADIX = 36;
const ID_START_INDEX = 2;
const ID_END_INDEX = 9;

const generateId = () =>
  Math.random().toString(RANDOM_RADIX).substring(ID_START_INDEX, ID_END_INDEX);

export const Toaster = (props: Record<string, unknown>) => {
  if (isServer) {
    return null;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic SolidJS component type
  const [ToasterComponent, setToasterComponent] = createSignal<any>(null);

  onMount(() => {
    import("solid-toast").then((module) => {
      solidToast = module.toast as unknown as SolidToastFunction;
      setToasterComponent(() => module.Toaster);
    });
  });

  return (
    <Show when={ToasterComponent()}>
      {(Comp) => createComponent(Comp, props)}
    </Show>
  );
};

// biome-ignore lint/suspicious/noExplicitAny: Base toast function proxy
const toastProxy = ((...args: [any, ToastOptions?]) => {
  if (isServer) {
    return "";
  }

  if (solidToast) {
    return solidToast(...args);
  }

  const id = args[1]?.id || generateId();
  const options = { ...args[1], id };

  import("solid-toast").then((module) => {
    solidToast = module.toast as unknown as SolidToastFunction;
    solidToast(args[0], options);
  });

  return id;
}) as unknown as SolidToastFunction;

const createProxyMethod = (method: keyof SolidToastFunction) => {
  // biome-ignore lint/suspicious/noExplicitAny: Arguments forwarded dynamically
  return (...args: any[]) => {
    if (isServer) {
      return "";
    }

    if (solidToast?.[method]) {
      // @ts-expect-error - dynamic method invocation
      return solidToast[method](...args);
    }

    // Special handling for promise which has options at index 2, others at index 1
    const optionsIndex = method === "promise" ? 2 : 1;
    const id = args[optionsIndex]?.id || generateId();
    const options = { ...args[optionsIndex], id };

    const newArgs = [...args];
    newArgs[optionsIndex] = options;

    import("solid-toast").then((module) => {
      solidToast = module.toast as unknown as SolidToastFunction;
      if (solidToast?.[method]) {
        // @ts-expect-error - dynamic method invocation
        solidToast[method](...newArgs);
      }
    });

    return id;
  };
};

// biome-ignore lint/suspicious/noExplicitAny: Required for library method proxy
toastProxy.success = createProxyMethod("success") as any;
// biome-ignore lint/suspicious/noExplicitAny: Required for library method proxy
toastProxy.error = createProxyMethod("error") as any;
// biome-ignore lint/suspicious/noExplicitAny: Required for library method proxy
toastProxy.loading = createProxyMethod("loading") as any;
// biome-ignore lint/suspicious/noExplicitAny: Required for library method proxy
toastProxy.promise = createProxyMethod("promise") as any;
// biome-ignore lint/suspicious/noExplicitAny: Required for library method proxy
toastProxy.custom = createProxyMethod("custom") as any;

toastProxy.dismiss = (id?: string) => {
  if (isServer) {
    return;
  }
  if (solidToast) {
    solidToast.dismiss(id);
    return;
  }
  import("solid-toast").then((module) => {
    solidToast = module.toast as unknown as SolidToastFunction;
    solidToast.dismiss(id);
  });
};

toastProxy.remove = (id?: string) => {
  if (isServer) {
    return;
  }
  if (solidToast) {
    solidToast.remove(id);
    return;
  }
  import("solid-toast").then((module) => {
    solidToast = module.toast as unknown as SolidToastFunction;
    solidToast.remove(id);
  });
};

export const toast = toastProxy;
export default toast;
