// Adapted from the Solid UI v2 badge registry recipe.
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type { ComponentProps, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";
import { Polymorphic, type PolymorphicProps } from "./utils/polymorphic";

const badgeVariants = cva(
	"inline-flex items-center rounded-md border px-2 py-0.5 font-semibold text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
				outline: "text-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

type BadgeProps<Tag extends ValidComponent = "div"> = PolymorphicProps<
	Tag,
	ComponentProps<"div"> & VariantProps<typeof badgeVariants>
>;

function Badge<Tag extends ValidComponent = "div">(props: BadgeProps<Tag>) {
	const local: Omit<BadgeProps, "as"> & { as?: ValidComponent } = props;
	const others = omit(local, "as", "class", "variant");
	return (
		<Polymorphic
			as={props.as ?? "div"}
			data-slot="badge"
			data-variant={props.variant}
			class={cn(badgeVariants({ variant: props.variant }), props.class)}
			{...others}
		/>
	);
}

export type { BadgeProps };
export { Badge, badgeVariants };
