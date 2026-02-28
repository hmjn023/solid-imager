import { createSignal, onCleanup, splitProps } from "solid-js";
import { toast } from "solid-toast";
import { cn } from "./utils/cn";

type ClipboardCopyProps = {
  text: string;
  label?: string;
  class?: string;
  iconSize?: number;
};

const DEFAULT_ICON_SIZE = 14;
const RESET_TIMEOUT = 2000;

function CopyIcon(props: { size?: number; class?: string }) {
  return (
    <svg
      aria-hidden="true"
      class={props.class}
      fill="none"
      height={props.size}
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
      width={props.size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="14" rx="2" ry="2" width="14" x="8" y="8" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon(props: { size?: number; class?: string }) {
  return (
    <svg
      aria-hidden="true"
      class={props.class}
      fill="none"
      height={props.size}
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
      width={props.size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ClipboardCopy(props: ClipboardCopyProps) {
  const [copied, setCopied] = createSignal(false);
  const [local, others] = splitProps(props, [
    "text",
    "label",
    "class",
    "iconSize",
  ]);

  let timeoutId: number | undefined;

  onCleanup(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });

  const handleCopy = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!local.text) {
      return;
    }

    // Secure Context check (navigator.clipboard)
    if (!navigator.clipboard) {
      toast.error(
        "Clipboard API not supported or not in a Secure Context (HTTPS/localhost)."
      );
      return;
    }

    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    try {
      await navigator.clipboard.writeText(local.text);
      setCopied(true);
      toast.success("Copied to clipboard");

      timeoutId = window.setTimeout(() => {
        setCopied(false);
        timeoutId = undefined;
      }, RESET_TIMEOUT);
    } catch (_error) {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      aria-label={local.label || "Copy to clipboard"}
      class={cn(
        "inline-flex items-center justify-center rounded-sm transition-colors hover:bg-gray-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        local.class
      )}
      onClick={handleCopy}
      title={local.label || "Copy to clipboard"}
      type="button"
      {...others}
    >
      {copied() ? (
        <CheckIcon
          class="text-green-600"
          size={local.iconSize || DEFAULT_ICON_SIZE}
        />
      ) : (
        <CopyIcon
          class="text-gray-500 hover:text-gray-700"
          size={local.iconSize || DEFAULT_ICON_SIZE}
        />
      )}
    </button>
  );
}
