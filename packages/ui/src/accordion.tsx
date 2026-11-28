// Adapted from the Solid UI v2 accordion registry recipe.
import {
	Accordion as AccordionPrimitiveRoot,
	AccordionHeader,
	AccordionItem as AccordionPrimitiveItem,
	AccordionPanel,
	AccordionTrigger as AccordionPrimitiveTrigger,
} from "@ui-sdk/solid/accordion";
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import type { ComponentProps, JSX, ValidComponent } from "@solidjs/web";
import { merge, omit } from "solid-js";

import { cn } from "./utils/cn";

type AccordionProps = Omit<
	ComponentProps<typeof AccordionPrimitiveRoot>,
	"class"
> & {
	class?: string;
};

const Accordion = (props: AccordionProps) => (
	<AccordionPrimitiveRoot {...props} class={props.class} />
);

type AccordionItemProps = Omit<
	ComponentProps<typeof AccordionPrimitiveItem>,
	"class"
> & {
	class?: string | undefined;
};

const AccordionItem = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, AccordionItemProps>,
) => {
	const others = omit(
		props as AccordionItemProps & { as?: ValidComponent },
		"as",
		"render",
		"class",
	);
	return (
		<AccordionPrimitiveItem
			render={props.as ? renderAs(() => props.as) : props.render}
			class={cn("border-b", props.class)}
			{...others}
		/>
	);
};

type AccordionTriggerProps = Omit<
	ComponentProps<typeof AccordionPrimitiveTrigger>,
	"class"
> & {
	class?: string | undefined;
	children?: JSX.Element;
};

const AccordionTrigger = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, AccordionTriggerProps>,
) => {
	const others = omit(
		props as AccordionTriggerProps & { as?: ValidComponent },
		"as",
		"render",
		"class",
		"children",
	);
	const renderComponent = renderAs(() => props.as);
	const renderTrigger: AccordionTriggerProps["render"] = (part, state) => {
		const attributes = merge(part, () =>
			state.disabled ? { tabindex: -1 } : {},
		);
		if (props.as) return renderComponent(attributes);
		return props.render ? (
			props.render(attributes, state)
		) : (
			<button {...attributes} />
		);
	};
	return (
		<AccordionHeader class="flex">
			<AccordionPrimitiveTrigger
				render={renderTrigger}
				class={cn(
					"flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-open]>svg]:rotate-180",
					props.class,
				)}
				{...others}
			>
				{props.children}
				<svg
					aria-hidden="true"
					class="pointer-events-none size-4 shrink-0 transition-transform duration-200"
					data-slot="accordion-trigger-icon"
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</AccordionPrimitiveTrigger>
		</AccordionHeader>
	);
};

type AccordionContentProps = Omit<
	ComponentProps<typeof AccordionPanel>,
	"class"
> & {
	class?: string | undefined;
	children?: JSX.Element;
};

const AccordionContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, AccordionContentProps>,
) => {
	const others = omit(
		props as AccordionContentProps & { as?: ValidComponent },
		"as",
		"render",
		"class",
		"children",
	);
	return (
		<AccordionPanel
			render={props.as ? renderAs(() => props.as) : props.render}
			class={cn(
				"animate-accordion-up overflow-hidden text-sm transition-all data-[open]:animate-accordion-down",
				props.class,
			)}
			{...others}
		>
			<div data-slot="accordion-content-inner" class="pt-0 pb-4">
				{props.children}
			</div>
		</AccordionPanel>
	);
};

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
