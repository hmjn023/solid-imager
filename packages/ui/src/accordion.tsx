import {
	Accordion as AccordionPrimitiveRoot,
	AccordionHeader,
	AccordionItem as AccordionPrimitiveItem,
	AccordionPanel,
	AccordionTrigger as AccordionPrimitiveTrigger,
} from "@ui-sdk/solid/accordion";
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import type { ComponentProps, JSX, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";

const Accordion = AccordionPrimitiveRoot;

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
	return (
		<AccordionHeader class="flex">
			<AccordionPrimitiveTrigger
				render={props.as ? renderAs(() => props.as) : props.render}
				class={cn(
					"flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-open]>svg]:rotate-180",
					props.class,
				)}
				{...others}
			>
				{props.children}
				<svg
					aria-hidden="true"
					class="size-4 shrink-0 transition-transform duration-200"
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M6 9l6 6l6 -6" />
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
			<div class="pt-0 pb-4">{props.children}</div>
		</AccordionPanel>
	);
};

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
