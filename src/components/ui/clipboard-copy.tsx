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
        <span
          class="i-lucide-check text-green-600"
          style={{
            width: `${local.iconSize || DEFAULT_ICON_SIZE}px`,
            height: `${local.iconSize || DEFAULT_ICON_SIZE}px`,
          }}
        />
      ) : (
        <span
          class="i-lucide-copy text-gray-500 hover:text-gray-700"
          style={{
            width: `${local.iconSize || DEFAULT_ICON_SIZE}px`,
            height: `${local.iconSize || DEFAULT_ICON_SIZE}px`,
          }}
        />
      )}
    </button>
  );
}
