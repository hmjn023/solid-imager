import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as TooltipPrimitive from "@kobalte/core/tooltip";
import type { Component, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "./utils/cn";

const TooltipTrigger = TooltipPrimitive.Trigger;

const Tooltip: Component<TooltipPrimitive.TooltipRootProps> = (props) => (
	<TooltipPrimitive.Root gutter={4} {...props} />
);

type TooltipContentProps<T extends ValidComponent = "div"> =
	TooltipPrimitive.TooltipContentProps<T> & { class?: string | undefined };

const TooltipContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TooltipContentProps<T>>,
) => {
	const [local, others] = splitProps(props as TooltipContentProps, ["class"]);
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				class={cn(
					"fade-in-0 zoom-in-95 z-50 origin-kb-popover animate-in overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-popover-foreground text-sm shadow-md",
					local.class,
				)}
				{...others}
			/>
		</TooltipPrimitive.Portal>
	);
};

export { Tooltip, TooltipContent, TooltipTrigger };
