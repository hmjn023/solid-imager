import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as PopoverPrimitive from "@kobalte/core/popover";
import type { Component, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "./utils/cn";

const PopoverTrigger = PopoverPrimitive.Trigger;

const Popover: Component<PopoverPrimitive.PopoverRootProps> = (props) => (
	<PopoverPrimitive.Root gutter={4} {...props} />
);

type PopoverContentProps<T extends ValidComponent = "div"> =
	PopoverPrimitive.PopoverContentProps<T> & { class?: string | undefined };

const PopoverContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, PopoverContentProps<T>>,
) => {
	const [local, others] = splitProps(props as PopoverContentProps, ["class"]);
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				class={cn(
					"z-50 max-h-popover-fit-available w-popover-small origin-kb-popover overflow-auto overscroll-contain rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none motion-safe:data-[closed]:animate-out motion-safe:data-[expanded]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[expanded]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[expanded]:zoom-in-95",
					local.class,
				)}
				{...others}
			/>
		</PopoverPrimitive.Portal>
	);
};

export { Popover, PopoverContent, PopoverTrigger };
