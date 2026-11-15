import * as AlertPrimitive from "@kobalte/core/alert";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type { Component, ComponentProps, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

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

type AlertRootProps<T extends ValidComponent = "div"> =
	AlertPrimitive.AlertRootProps<T> &
		VariantProps<typeof alertVariants> & { class?: string | undefined };

const Alert = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, AlertRootProps<T>>,
) => {
	const [local, others] = splitProps(props as AlertRootProps, [
		"class",
		"variant",
	]);
	return (
		<AlertPrimitive.Root
			class={cn(alertVariants({ variant: local.variant }), local.class)}
			{...others}
		/>
	);
};

const AlertTitle: Component<ComponentProps<"h5">> = (props) => {
	const [local, others] = splitProps(props, ["class", "children"]);
	return (
		<h5
			class={cn("mb-1 font-medium leading-none tracking-tight", local.class)}
			{...others}
		>
			{local.children}
		</h5>
	);
};

const AlertDescription: Component<ComponentProps<"div">> = (props) => {
	const [local, others] = splitProps(props, ["class"]);
	return (
		<div class={cn("text-sm [&_p]:leading-relaxed", local.class)} {...others} />
	);
};

export { Alert, AlertDescription, AlertTitle, alertVariants };
