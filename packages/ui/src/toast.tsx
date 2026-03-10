import { isServer } from "solid-js/web";
import { default as toastDefault, Toaster as OriginalToaster, toast as originalToast } from "solid-toast";

export const Toaster = (props: any) => {
  if (isServer) return null;
  return <OriginalToaster {...props} />;
};

export const toast = (...args: any[]) => {
  if (isServer) return;
  // @ts-ignore
  return originalToast(...args);
};

export default toastDefault;
