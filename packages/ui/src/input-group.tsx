// Adapted from the Solid UI v2 input-group registry recipe.
import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "./utils/cn";

export function InputGroup(props: ComponentProps<"div">) {
	return (
		<div
			data-slot="input-group"
			role="group"
			{...omit(props, "class")}
			class={cn(
				"group/input-group flex min-w-0 items-center outline-none",
				props.class,
			)}
		/>
	);
}

export function InputGroupAddon(
	props: ComponentProps<"div"> & { align?: "inline-start" | "inline-end" },
) {
	const align = () => props.align ?? "inline-start";
	return (
		<div
			role="group"
			data-slot="input-group-addon"
			data-align={align()}
			onClick={(event) => {
				if (event.target instanceof Element && event.target.closest("button"))
					return;
				event.currentTarget.parentElement?.querySelector("input")?.focus();
			}}
			{...omit(props, "align", "class")}
			class={cn(
				"flex shrink-0 cursor-text select-none items-center justify-center",
				align() === "inline-start" ? "order-first" : "order-last",
				props.class,
			)}
		/>
	);
}
