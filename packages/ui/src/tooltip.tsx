// Adapted from the Solid UI v2 tooltip registry recipe.
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import {
	popupAlign,
	popupSide,
	type PopupPlacement,
} from "./utils/popup-placement";
import {
	Tooltip as SdkTooltip,
	TooltipArrow as SdkTooltipArrow,
	TooltipTrigger as SdkTooltipTrigger,
	TooltipContent as SdkTooltipContent,
} from "@ui-sdk/solid/tooltip";
import { createContext, omit, Show, useContext } from "solid-js";
import type { ComponentProps, ValidComponent } from "@solidjs/web";

import { cn } from "./utils/cn";

type TooltipProps = ComponentProps<typeof SdkTooltip> & {
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
			<SdkTooltip
				{...omit(
					props,
					"placement",
					"gutter",
					"openDelay",
					"closeDelay",
					"delay",
				)}
				delay={props.openDelay ?? props.delay}
				closeDelay={props.closeDelay}
			/>
		</TooltipContext>
	);
}

function TooltipTrigger<Tag extends ValidComponent = "button">(
	props: PolymorphicProps<Tag, ComponentProps<typeof SdkTooltipTrigger>>,
) {
	const partProps: ComponentProps<typeof SdkTooltipTrigger> & { as?: Tag } =
		props;
	return (
		<SdkTooltipTrigger
			{...omit(partProps, "as")}
			render={props.as ? renderAs(() => props.as) : props.render}
		/>
	);
}

type TooltipContentProps = Omit<
	ComponentProps<typeof SdkTooltipContent>,
	"class"
> & { class?: string | undefined; showArrow?: boolean };

const TooltipContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TooltipContentProps>,
) => {
	const partProps: TooltipContentProps & { as?: ValidComponent } = props;
	const others = omit(
		partProps,
		"class",
		"as",
		"render",
		"children",
		"showArrow",
	);
	const context = useContext(TooltipContext);
	return (
		<SdkTooltipContent
			side={popupSide(context.placement)}
			align={popupAlign(context.placement)}
			sideOffset={context.gutter ?? 4}
			render={props.as ? renderAs(() => props.as) : props.render}
			class={cn(
				"z-50 origin-(--transform-origin) overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-popover-foreground text-sm shadow-md motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[open]:zoom-in-95",
				props.class,
			)}
			{...others}
		>
			{props.children}
			<Show when={props.showArrow}>
				<SdkTooltipArrow class="z-50 -mt-0.5 size-2.5 -translate-y-1/2 rotate-45 rounded-xs bg-popover fill-popover" />
			</Show>
		</SdkTooltipContent>
	);
};

export { Tooltip, TooltipContent, TooltipTrigger };
