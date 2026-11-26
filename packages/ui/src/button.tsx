import { Button as ButtonPrimitive } from "@ui-sdk/solid/button";
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type { ComponentProps, JSX, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";

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
const Button = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, ButtonProps<T>>,
) => {
	const others = omit(
		props as ButtonProps & { as?: ValidComponent },
		"variant",
		"size",
		"class",
		"as",
		"aria-busy",
		"aria-expanded",
		"aria-pressed",
		"style",
		"disabled",
		"type",
	);
	return (
		<ButtonPrimitive
			style={props.style || undefined}
			disabled={props.disabled === "" || props.disabled === true}
			type={
				props.type === "submit" || props.type === "reset"
					? props.type
					: "button"
			}
			aria-busy={
				typeof props["aria-busy"] === "boolean"
					? props["aria-busy"]
						? "true"
						: "false"
					: props["aria-busy"]
			}
			aria-expanded={
				typeof props["aria-expanded"] === "boolean"
					? props["aria-expanded"]
						? "true"
						: "false"
					: props["aria-expanded"]
			}
			aria-pressed={
				typeof props["aria-pressed"] === "boolean"
					? props["aria-pressed"]
						? "true"
						: "false"
					: props["aria-pressed"]
			}
			render={props.as ? renderAs(() => props.as) : undefined}
			class={cn(
				buttonVariants({ variant: props.variant, size: props.size }),
				props.class,
			)}
			{...others}
		/>
	);
};

export type { ButtonProps };
export { Button, buttonVariants };
