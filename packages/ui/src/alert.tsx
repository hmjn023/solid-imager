// Adapted from the Solid UI v2 alert registry recipe.
import { Polymorphic, type PolymorphicProps } from "./utils/polymorphic";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type { Component } from "solid-js";
import type { ComponentProps, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";

const alertVariants = cva(
	"relative w-full rounded-lg border p-4 [&>svg+div]:-translate-y-0.5 [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
	{
		variants: {
			variant: {
				default: "bg-background text-foreground",
				destructive:
					"border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
				info: "border-info-foreground/30 bg-info text-info-foreground [&>svg]:text-info-foreground",
				success:
					"border-success-foreground/30 bg-success text-success-foreground [&>svg]:text-success-foreground",
				warning:
					"border-warning-foreground/30 bg-warning text-warning-foreground [&>svg]:text-warning-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

type AlertRootProps = ComponentProps<"div"> &
	VariantProps<typeof alertVariants> & { class?: string | undefined };

const Alert = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, AlertRootProps>,
) => {
	const others = omit(
		props as AlertRootProps & { as?: ValidComponent },
		"class",
		"variant",
		"as",
	);
	return (
		<Polymorphic
			as={props.as ?? "div"}
			data-slot="alert"
			role="alert"
			class={cn(alertVariants({ variant: props.variant }), props.class)}
			{...others}
		/>
	);
};

const AlertTitle: Component<ComponentProps<"h5">> = (props) => (
	<h5
		data-slot="alert-title"
		{...props}
		class={cn("mb-1 font-medium leading-none tracking-tight", props.class)}
	/>
);

const AlertDescription: Component<ComponentProps<"div">> = (props) => (
	<div
		data-slot="alert-description"
		{...props}
		class={cn("text-sm [&_p]:leading-relaxed", props.class)}
	/>
);

export { Alert, AlertDescription, AlertTitle, alertVariants };
