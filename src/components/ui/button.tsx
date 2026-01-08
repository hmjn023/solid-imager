import {
  Root as ButtonPrimitiveRoot,
  type ButtonRootProps,
} from "@kobalte/core/button";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/presentation/utils/cn";

/**
 * Defines the styles for the button component using `class-variance-authority`.
 * It includes various visual variants and sizes.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-8",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Props for the Button component.
 * Extends ButtonRootProps from `@kobalte/core/button` and VariantProps from `class-variance-authority`.
 * @template T - The valid component type, defaults to "button".
 * @property {string} [class] - Optional CSS class for custom styling.
 * @property {JSX.Element} [children] - The content to be rendered inside the button.
 */
type ButtonProps<T extends ValidComponent = "button"> = ButtonRootProps<T> &
  VariantProps<typeof buttonVariants> & {
    class?: string | undefined;
    children?: JSX.Element;
  };
/**
 * A customizable button component that supports various styles and sizes.
 * It leverages `@kobalte/core/button` for accessibility and `class-variance-authority` for styling.
 * @template T - The valid component type, defaults to "button".
 * @param {PolymorphicProps<T, ButtonProps<T>>} props - The properties for the button component.
 * @returns {JSX.Element} The rendered button component.
 */
const Button = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, ButtonProps<T>>
) => {
  const [local, others] = splitProps(props as ButtonProps, [
    "variant",
    "size",
    "class",
  ]);
  return (
    <ButtonPrimitiveRoot
      class={cn(
        buttonVariants({ variant: local.variant, size: local.size }),
        local.class
      )}
      {...others}
    />
  );
};
export { Button, buttonVariants };
export type { ButtonProps };
