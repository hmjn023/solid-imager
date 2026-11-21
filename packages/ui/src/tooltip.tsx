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
					"z-50 origin-kb-tooltip overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-popover-foreground text-sm shadow-md motion-safe:data-[closed]:animate-out motion-safe:data-[expanded]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[expanded]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[expanded]:zoom-in-95",
					local.class,
				)}
				{...others}
			/>
		</TooltipPrimitive.Portal>
	);
};

export { Tooltip, TooltipContent, TooltipTrigger };
