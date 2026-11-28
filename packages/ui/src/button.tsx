// Adapted from the Solid UI v2 button registry recipe.
import {
	dynamic,
	type ComponentProps,
	type JSX,
	type ValidComponent,
} from "@solidjs/web";
import { cva, type VariantProps } from "class-variance-authority";
import { isStatic, omit, untrack } from "solid-js";

import { cn } from "./utils/cn";
import type { PolymorphicProps } from "./utils/polymorphic";

/**
 * Defines the styles for the button component using `class-variance-authority`.
 * It includes various visual variants and sizes.
 */
const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary-hover",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive-hover",
				outline: "border border-input hover:bg-muted hover:text-foreground",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost: "hover:bg-muted hover:text-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-11 px-4 py-2",
				sm: "min-h-11 px-3 text-xs sm:min-h-9",
				lg: "h-11 px-8",
				icon: "size-11 sm:size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type BooleanAria = Pick<
	ComponentProps<"button">,
	"aria-busy" | "aria-expanded" | "aria-pressed"
>;
type ButtonProps<T extends ValidComponent = "button"> = Omit<
	ComponentProps<T>,
	"class" | "children" | keyof BooleanAria
> & { [K in keyof BooleanAria]?: BooleanAria[K] | boolean } & VariantProps<
		typeof buttonVariants
	> & {
		class?: string | undefined;
		children?: JSX.Element;
	};
function ariaBoolean(
	value: Exclude<BooleanAria[keyof BooleanAria], boolean> | boolean,
) {
	if (typeof value === "boolean") return value ? "true" : "false";
	return value;
}

function Button<T extends ValidComponent = "button">(
	props: PolymorphicProps<T, ButtonProps<T>>,
) {
	const Element = dynamic<ValidComponent>(() => props.as ?? "button", {
		static: untrack(() => isStatic(props, "as")),
	});
	const rest = omit(
		props as ButtonProps & { as?: ValidComponent },
		"variant",
		"size",
		"class",
		"as",
		"aria-busy",
		"aria-expanded",
		"aria-pressed",
	);
	return (
		<Element
			type={(props.as ?? "button") === "button" ? "button" : undefined}
			data-slot="button"
			data-variant={props.variant === undefined ? "default" : props.variant}
			data-size={props.size === undefined ? "default" : props.size}
			aria-busy={ariaBoolean(props["aria-busy"])}
			aria-expanded={ariaBoolean(props["aria-expanded"])}
			aria-pressed={ariaBoolean(props["aria-pressed"])}
			class={cn(
				buttonVariants({ variant: props.variant, size: props.size }),
				props.class,
			)}
			{...rest}
		/>
	);
}

export type { ButtonProps };
export { Button, buttonVariants };
