// Adapted from the Solid UI v2 label registry recipe.
import type { ComponentProps } from "@solidjs/web";
import { cn } from "./utils/cn";

export function Label(props: ComponentProps<"label">) {
	return (
		// oxlint-disable-next-line jsx-a11y/label-has-associated-control -- Generic Label component
		<label
			data-slot="label"
			{...props}
			class={cn(
				"select-none font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				props.class,
			)}
		/>
	);
}
