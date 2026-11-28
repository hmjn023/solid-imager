// Adapted from the Solid UI v2 input registry recipe.
import type { ComponentProps } from "@solidjs/web";
import { cn } from "./utils/cn";

export type InputProps = ComponentProps<"input">;

export function Input(props: InputProps) {
	return (
		<input
			data-slot="input"
			{...props}
			class={cn(
				"flex min-h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				props.class,
			)}
		/>
	);
}
