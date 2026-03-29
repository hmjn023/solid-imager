import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "./utils/cn";

/**
 * Props for the Input component, extending standard HTML input attributes.
 */
export type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;
/**
 * A customizable input component that extends standard HTML input functionality.
 * It applies consistent styling and handles common input attributes.
 * @param {InputProps} props - The properties for the input component.
 * @returns {JSX.Element} The rendered input element.
 */
export function Input(props: InputProps) {
	const [local, rest] = splitProps(props, ["class"]);
	return (
		<input
			class={cn(
				"flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				local.class,
			)}
			{...rest}
		/>
	);
}
