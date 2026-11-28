// Adapted from the Solid UI v2 separator registry recipe.
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import { Separator as SeparatorPrimitive } from "@ui-sdk/solid/separator";
import type { ComponentProps, ValidComponent } from "@solidjs/web";
import { merge, omit } from "solid-js";

import { cn } from "./utils/cn";

type SeparatorRootProps = Omit<
	ComponentProps<typeof SeparatorPrimitive>,
	"class"
> & { class?: string; "data-slot"?: string };

const Separator = <T extends ValidComponent = "hr">(
	props: PolymorphicProps<T, SeparatorRootProps>,
) => {
	const others = omit(
		props as SeparatorRootProps & { as?: ValidComponent },
		"class",
		"orientation",
		"as",
		"render",
		"data-slot",
	);
	const renderComponent = renderAs(() => props.as);
	const renderSeparator: SeparatorRootProps["render"] = (part, state) => {
		const attributes = merge(part, () => ({
			"data-slot": props["data-slot"] ?? "separator",
		}));
		if (props.as) return renderComponent(attributes);
		return props.render ? (
			props.render(attributes, state)
		) : (
			<div {...attributes} />
		);
	};
	return (
		<SeparatorPrimitive
			render={renderSeparator}
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
