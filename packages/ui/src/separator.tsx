import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import { Separator as SeparatorPrimitive } from "@ui-sdk/solid/separator";
import type { ComponentProps, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";

type SeparatorRootProps = Omit<
	ComponentProps<typeof SeparatorPrimitive>,
	"class"
> & { class?: string | undefined };

const Separator = <T extends ValidComponent = "hr">(
	props: PolymorphicProps<T, SeparatorRootProps>,
) => {
	const others = omit(
		props as SeparatorRootProps & { as?: ValidComponent },
		"class",
		"orientation",
		"as",
	);
	return (
		<SeparatorPrimitive
			render={props.as ? renderAs(() => props.as) : undefined}
			class={cn(
				"shrink-0 bg-border",
				props.orientation === "vertical" ? "h-full w-px" : "h-px w-full",
				props.class,
			)}
			orientation={props.orientation ?? "horizontal"}
			{...others}
		/>
	);
};

export { Separator };
