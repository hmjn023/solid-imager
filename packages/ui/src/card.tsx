// Adapted from the Solid UI v2 card registry recipe.
import type { ComponentProps } from "@solidjs/web";
import { cn } from "./utils/cn";

export function Card(props: ComponentProps<"div">) {
	return (
		<div
			data-slot="card"
			{...props}
			class={cn(
				"rounded-lg border bg-card text-card-foreground shadow-sm",
				props.class,
			)}
		/>
	);
}

export function CardHeader(props: ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			{...props}
			class={cn("flex flex-col space-y-1.5 p-6", props.class)}
		/>
	);
}

export function CardTitle(props: ComponentProps<"h3">) {
	return (
		<h3
			data-slot="card-title"
			{...props}
			class={cn(
				"font-semibold text-lg leading-none tracking-tight",
				props.class,
			)}
		/>
	);
}

export function CardDescription(props: ComponentProps<"p">) {
	return (
		<p
			data-slot="card-description"
			{...props}
			class={cn("text-muted-foreground text-sm", props.class)}
		/>
	);
}

export function CardContent(props: ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			{...props}
			class={cn("p-6 pt-0", props.class)}
		/>
	);
}

export function CardFooter(props: ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer"
			{...props}
			class={cn("flex items-center p-6 pt-0", props.class)}
		/>
	);
}
