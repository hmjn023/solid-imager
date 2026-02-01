import { createSignal, splitProps } from "solid-js";
import { toast } from "solid-toast";
import { cn } from "~/presentation/utils/cn";

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
      aria-label="Copy icon"
      class={props.class}
      fill="none"
      height={props.size || 24}
      role="img"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
      width={props.size || 24}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Copy icon</title>
      <rect height="14" rx="2" ry="2" width="14" x="8" y="8" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon(props: { size?: number; class?: string }) {
  return (
    <svg
      aria-label="Check icon"
      class={props.class}
      fill="none"
      height={props.size || 24}
      role="img"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
      width={props.size || 24}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Check icon</title>
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

    try {
      await navigator.clipboard.writeText(local.text);
      setCopied(true);
      toast.success("クリップボードにコピーしました");

      setTimeout(() => {
        setCopied(false);
      }, RESET_TIMEOUT);
    } catch (_error) {
      toast.error("コピーに失敗しました");
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
