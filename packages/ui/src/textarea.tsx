// Adapted from the Solid UI v2 textarea registry recipe.
import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "./utils/cn";

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea(props: TextareaProps) {
	const others = omit(props, "class", "rows");
	return (
		<textarea
			data-slot="textarea"
			class={cn(
				"flex min-h-thumbnail-preview w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				props.class,
			)}
			rows={props.rows}
			{...others}
		/>
	);
}
