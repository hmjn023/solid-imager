import type { JSX } from "@solidjs/web";

import { cn } from "./utils/cn";

export type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = (props: TextareaProps) => {
	const local = props,
		rest = omit(props, "class");
	return (
		<textarea
			class={cn(
				"flex min-h-thumbnail-preview w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				local.class,
			)}
			{...rest}
		/>
	);
};

export { Textarea };

import { omit } from "solid-js";
