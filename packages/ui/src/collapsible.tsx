import type { ComponentProps, ValidComponent } from "@solidjs/web";
import {
	Collapsible as CollapsiblePrimitive,
	CollapsiblePanel,
	CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from "@ui-sdk/solid/collapsible";
import { omit } from "solid-js";
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";

export const Collapsible = CollapsiblePrimitive;
export const CollapsibleContent = CollapsiblePanel;

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
			{...omit(partProps, "as")}
			render={props.as ? renderAs(() => props.as) : props.render}
		/>
	);
}

export const CollapsibleRoot = {
	Root: Collapsible,
	Trigger: CollapsibleTrigger,
	Content: CollapsibleContent,
};
