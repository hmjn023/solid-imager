import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import {
	popupAlign,
	popupSide,
	type PopupPlacement,
} from "./utils/popup-placement";
import {
	Popover as Primitive,
	PopoverTrigger as TriggerPrimitive,
	PopoverContent as ContentPrimitive,
} from "@ui-sdk/solid/popover";
import { createContext, useContext } from "solid-js";
import type { ComponentProps, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";

type PopoverProps = ComponentProps<typeof Primitive> & {
	placement?: PopupPlacement;
	gutter?: number;
};
const PopoverContext = createContext<
	Pick<PopoverProps, "placement" | "gutter">
>({});

function Popover(props: PopoverProps) {
	return (
		<PopoverContext value={props}>
			<Primitive {...omit(props, "placement", "gutter")} />
		</PopoverContext>
	);
}

function PopoverTrigger<Tag extends ValidComponent = "button">(
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

type PopoverContentProps = Omit<
	ComponentProps<typeof ContentPrimitive>,
	"class"
> & { class?: string | undefined };

const PopoverContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, PopoverContentProps>,
) => {
	const partProps: PopoverContentProps & { as?: ValidComponent } = props;
	const others = omit(partProps, "class", "as", "render");
	const context = useContext(PopoverContext);
	return (
		<ContentPrimitive
			side={popupSide(context.placement)}
			align={popupAlign(context.placement)}
			sideOffset={context.gutter ?? 4}
			render={props.as ? renderAs(() => props.as) : props.render}
			class={cn(
				"z-50 max-h-popover-fit-available w-popover-small origin-(--transform-origin) overflow-auto overscroll-contain rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[open]:zoom-in-95",
				props.class,
			)}
			{...others}
		/>
	);
};

export { Popover, PopoverContent, PopoverTrigger };
