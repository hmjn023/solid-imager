// Adapted from the Solid UI v2 collapsible registry recipe.
import type { ComponentProps, ValidComponent } from "@solidjs/web";
import {
	Collapsible as CollapsiblePrimitive,
	CollapsiblePanel,
	CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from "@ui-sdk/solid/collapsible";
import { omit } from "solid-js";
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";

type CollapsibleProps = Omit<
	ComponentProps<typeof CollapsiblePrimitive>,
	"class"
> & {
	class?: string;
};

export function Collapsible(props: CollapsibleProps) {
	return <CollapsiblePrimitive {...props} class={props.class} />;
}

type CollapsibleContentProps = Omit<
	ComponentProps<typeof CollapsiblePanel>,
	"class"
> & {
	class?: string;
};

export function CollapsibleContent(props: CollapsibleContentProps) {
	return (
		<CollapsiblePanel class={props.class} {...omit(props, "class", "children")}>
			{props.children}
		</CollapsiblePanel>
	);
}

export function CollapsibleTrigger<Tag extends ValidComponent = "button">(
	props: PolymorphicProps<
		Tag,
		ComponentProps<typeof CollapsibleTriggerPrimitive>
	>,
) {
	const partProps: ComponentProps<typeof CollapsibleTriggerPrimitive> & {
		as?: Tag;
	} = props;
	return (
		<CollapsibleTriggerPrimitive
			{...omit(partProps, "as", "children", "render")}
			render={props.as ? renderAs(() => props.as) : props.render}
		>
			{props.children}
		</CollapsibleTriggerPrimitive>
	);
}

export const CollapsibleRoot = {
	Root: Collapsible,
	Trigger: CollapsibleTrigger,
	Content: CollapsibleContent,
};
