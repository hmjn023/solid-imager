// Adapted from the Solid UI v2 popover registry recipe.
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import {
	popupAlign,
	popupSide,
	type PopupPlacement,
} from "./utils/popup-placement";
import {
	Popover as SdkPopover,
	PopoverArrow as SdkPopoverArrow,
	PopoverClose as SdkPopoverClose,
	PopoverTrigger as SdkPopoverTrigger,
	PopoverContent as SdkPopoverContent,
	PopoverDescription as SdkPopoverDescription,
	PopoverTitle as SdkPopoverTitle,
} from "@ui-sdk/solid/popover";
import { createContext, useContext } from "solid-js";
import type { ComponentProps, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";

type PopoverProps = ComponentProps<typeof SdkPopover> & {
	placement?: PopupPlacement;
	gutter?: number;
};
const PopoverContext = createContext<
	Pick<PopoverProps, "placement" | "gutter">
>({});

function Popover(props: PopoverProps) {
	return (
		<PopoverContext value={props}>
			<SdkPopover {...omit(props, "placement", "gutter")} />
		</PopoverContext>
	);
}

function PopoverTrigger<Tag extends ValidComponent = "button">(
	props: PolymorphicProps<Tag, ComponentProps<typeof SdkPopoverTrigger>>,
) {
	const partProps: ComponentProps<typeof SdkPopoverTrigger> & { as?: Tag } =
		props;
	return (
		<SdkPopoverTrigger
			{...omit(partProps, "as")}
			render={props.as ? renderAs(() => props.as) : props.render}
		/>
	);
}

type PopoverContentProps = Omit<
	ComponentProps<typeof SdkPopoverContent>,
	"class"
> & { class?: string | undefined };

const PopoverContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, PopoverContentProps>,
) => {
	const partProps: PopoverContentProps & { as?: ValidComponent } = props;
	const others = omit(partProps, "class", "as", "render", "children");
	const context = useContext(PopoverContext);
	return (
		<SdkPopoverContent
			side={popupSide(context.placement)}
			align={popupAlign(context.placement)}
			sideOffset={context.gutter ?? 4}
			render={props.as ? renderAs(() => props.as) : props.render}
			class={cn(
				"z-50 max-h-popover-fit-available w-popover-small origin-(--transform-origin) overflow-auto overscroll-contain rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:fade-out-0 motion-safe:data-[open]:fade-in-0 motion-safe:data-[closed]:zoom-out-95 motion-safe:data-[open]:zoom-in-95",
				props.class,
			)}
			{...others}
		>
			{props.children}
		</SdkPopoverContent>
	);
};

type ClassProps<T> = Omit<T, "class"> & { class?: string };

const PopoverCloseButton = (
	props: ClassProps<ComponentProps<typeof SdkPopoverClose>>,
) => <SdkPopoverClose {...props} />;

const PopoverHeader = (props: ComponentProps<"div">) => (
	<div
		data-slot="popover-header"
		{...omit(props, "class")}
		class={cn("flex flex-col gap-0.5 text-sm", props.class)}
	/>
);

const PopoverTitle = (
	props: ClassProps<ComponentProps<typeof SdkPopoverTitle>>,
) => (
	<SdkPopoverTitle
		{...omit(props, "class")}
		class={cn("font-medium", props.class)}
	/>
);

const PopoverDescription = (
	props: ClassProps<ComponentProps<typeof SdkPopoverDescription>>,
) => (
	<SdkPopoverDescription
		{...omit(props, "class")}
		class={cn("text-muted-foreground", props.class)}
	/>
);

const PopoverArrow = (
	props: ClassProps<ComponentProps<typeof SdkPopoverArrow>>,
) => <SdkPopoverArrow {...props} />;

export {
	Popover,
	PopoverArrow,
	PopoverCloseButton,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
};
