import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import { Toggle as ToggleButtonPrimitive } from "@ui-sdk/solid/toggle";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type { ComponentProps, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";

const toggleVariants = cva(
	"inline-flex items-center justify-center rounded-md font-medium text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				outline: "border border-input bg-transparent shadow-sm",
			},
			size: {
				default: "h-9 px-3",
				sm: "h-8 px-2",
				lg: "h-10 px-3",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type ToggleButtonRootProps = Omit<
	ComponentProps<typeof ToggleButtonPrimitive>,
	"class" | "onPressedChange" | "onChange"
> & { onChange?: (pressed: boolean) => void } & VariantProps<
		typeof toggleVariants
	> & {
		class?: string | undefined;
		"data-toggle-group-item"?: "";
	};

const Toggle = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, ToggleButtonRootProps>,
) => {
	const others = omit(
		props as ToggleButtonRootProps & { as?: ValidComponent },
		"class",
		"variant",
		"size",
		"onChange",
		"as",
	);
	return (
		<ToggleButtonPrimitive
			render={props.as ? renderAs(() => props.as) : undefined}
			onPressedChange={props.onChange}
			class={cn(
				toggleVariants({ variant: props.variant, size: props.size }),
				props["data-toggle-group-item"] !== undefined &&
					"hover:bg-muted hover:text-muted-foreground data-[pressed]:bg-accent data-[pressed]:text-accent-foreground",
				props.class,
			)}
			{...others}
		/>
	);
};

export type { ToggleButtonRootProps as ToggleProps };
export { Toggle, toggleVariants };
