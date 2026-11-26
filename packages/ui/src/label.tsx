import type { Component } from "solid-js";
import type { ComponentProps } from "@solidjs/web";

import { cn } from "./utils/cn";

const Label: Component<ComponentProps<"label">> = (props) => {
	const local = props,
		others = omit(props, "class");
	return (
		// oxlint-disable-next-line jsx-a11y/label-has-associated-control -- Generic Label component
		<label
			class={cn(
				"font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				local.class,
			)}
			{...others}
		/>
	);
};

export { Label };

import { omit } from "solid-js";
