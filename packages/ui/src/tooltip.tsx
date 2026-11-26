import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import {
	popupAlign,
	popupSide,
	type PopupPlacement,
} from "./utils/popup-placement";
import {
	Tooltip as Primitive,
	TooltipTrigger as TriggerPrimitive,
	TooltipContent as ContentPrimitive,
} from "@ui-sdk/solid/tooltip";
import { createContext, useContext } from "solid-js";
import type { ComponentProps, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";

type TooltipProps = ComponentProps<typeof Primitive> & {
	placement?: PopupPlacement;
	gutter?: number;
	openDelay?: number;
	closeDelay?: number;
};
const TooltipContext = createContext<
	Pick<TooltipProps, "placement" | "gutter">
>({});

function Tooltip(props: TooltipProps) {
	return (
		<TooltipContext value={props}>
			<Primitive
				{...omit(props, "placement", "gutter", "openDelay", "closeDelay")}
				delay={props.openDelay}
				closeDelay={props.closeDelay}
			/>
		</TooltipContext>
	);
}

function TooltipTrigger<Tag extends ValidComponent = "button">(
	props: PolymorphicProps<Tag, ComponentProps<typeof TriggerPrimitive>>,
) {
	const partProps: ComponentProps<typeof TriggerPrimitive> & { as?: Tag } =
		props;
	return (
		<TriggerPrimitive
			{...omit(partProps, "as")}
			render={props.as ? renderAs(() => props.as) : props.render}
		/>
	);
}

type TooltipContentProps = Omit<
	ComponentProps<typeof ContentPrimitive>,
	"class"
> & { class?: string | undefined };

const TooltipContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TooltipContentProps>,
) => {
	const partProps: TooltipContentProps & { as?: ValidComponent } = props;
	const others = omit(partProps, "class", "as", "render");
	const context = useContext(TooltipContext);
	return (
		<ContentPrimitive
			side={popupSide(context.placement)}
			align={popupAlign(context.placement)}
			sideOffset={context.gutter ?? 4}
			render={props.as ? renderAs(() => props.as) : props.render}
			class={cn(
				"z-50 origin-(--transform-origin) overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-popover-foreground text-sm shadow-md motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[open]:zoom-in-95",
				props.class,
			)}
			{...others}
		/>
	);
};

export { Tooltip, TooltipContent, TooltipTrigger };
