// Adapted from the Solid UI v2 dropdown-menu and context-menu registry recipes.
import {
	Portal,
	type ComponentProps,
	type JSX,
	type ValidComponent,
} from "@solidjs/web";
import {
	Menu as MenuPrimitive,
	MenuCheckboxItem as MenuCheckboxItemPrimitive,
	MenuContent as MenuContentPrimitive,
	MenuContextTrigger as MenuContextTriggerPrimitive,
	MenuGroup,
	MenuGroupLabel as MenuGroupLabelPrimitive,
	MenuItem as MenuItemPrimitive,
	MenuItemIndicator,
	MenuRadioGroup as MenuRadioGroupPrimitive,
	MenuRadioItem as MenuRadioItemPrimitive,
	MenuSeparator as MenuSeparatorPrimitive,
	MenuSub,
	MenuSubTrigger as MenuSubTriggerPrimitive,
	MenuTrigger as MenuTriggerPrimitive,
	createMenuController,
} from "@ui-sdk/solid/menu";
import { createContext, createUniqueId, omit, useContext } from "solid-js";
import { dialogFinalFocus } from "./dialog";
import { cn } from "./utils/cn";
import { renderAs, type PolymorphicProps } from "./utils/polymorphic";
import {
	popupAlign,
	popupSide,
	type PopupPlacement,
} from "./utils/popup-placement";
import { ChevronRight } from "./workspace/icons";
import { Check, Circle } from "@lucide/solid";

type MenuProps = ComponentProps<typeof MenuPrimitive> & {
	placement?: PopupPlacement;
	gutter?: number;
};

const MenuContext = createContext<{
	props: MenuProps;
	controller: NonNullable<MenuProps["controller"]>;
}>();

export function Menu(props: MenuProps) {
	const controller = props.controller ?? createMenuController();
	return (
		<MenuContext value={{ props, controller }}>
			<MenuPrimitive
				{...omit(props, "placement", "gutter")}
				controller={controller}
			/>
		</MenuContext>
	);
}

export function useMenuContext() {
	return useContext(MenuContext).controller;
}

export function MenuTrigger<Tag extends ValidComponent = "button">(
	props: PolymorphicProps<Tag, ComponentProps<typeof MenuTriggerPrimitive>>,
) {
	const partProps: ComponentProps<typeof MenuTriggerPrimitive> & { as?: Tag } =
		props;
	return (
		<MenuTriggerPrimitive
			{...omit(partProps, "as")}
			render={props.as ? renderAs(() => props.as) : props.render}
		/>
	);
}

export function MenuContextTrigger<Tag extends ValidComponent = "div">(
	props: PolymorphicProps<
		Tag,
		ComponentProps<typeof MenuContextTriggerPrimitive>
	>,
) {
	const partProps: ComponentProps<typeof MenuContextTriggerPrimitive> & {
		as?: Tag;
	} = props;
	return (
		<MenuContextTriggerPrimitive
			{...omit(partProps, "as")}
			render={props.as ? renderAs(() => props.as) : props.render}
		/>
	);
}

type ClassProps<Props> = Omit<Props, "class"> & { class?: string };

type MenuContentProps<Payload> = ClassProps<
	ComponentProps<typeof MenuContentPrimitive<Payload>>
> & {
	onCloseAutoFocus?: (event: Event) => void;
};

export function MenuContent<Payload = unknown>(
	props: MenuContentProps<Payload>,
) {
	const root = useContext(MenuContext).props;
	return (
		<MenuContentPrimitive<Payload>
			side={popupSide(root.placement)}
			align={popupAlign(root.placement)}
			sideOffset={root.gutter ?? 4}
			{...omit(props, "class", "onCloseAutoFocus", "finalFocus")}
			finalFocus={dialogFinalFocus(props.onCloseAutoFocus, props.finalFocus)}
			class={cn(
				"z-50 max-h-popover-fit-available min-w-32 origin-(--transform-origin) overflow-y-auto overflow-x-hidden overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none data-closed:overflow-hidden motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-content-show motion-safe:data-[closed]:fade-out-0",
				props.class,
			)}
		/>
	);
}

const menuItemClass =
	"relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-muted focus:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0";

type MenuItemProps = ClassProps<ComponentProps<typeof MenuItemPrimitive>> & {
	inset?: boolean;
	variant?: "default" | "destructive";
};

export function MenuItem<Tag extends ValidComponent = "div">(
	props: PolymorphicProps<Tag, MenuItemProps>,
) {
	const partProps: MenuItemProps & { as?: Tag } = props;
	return (
		<MenuItemPrimitive
			{...omit(partProps, "as", "class", "inset", "variant")}
			data-inset={props.inset ? "" : undefined}
			data-variant={props.variant ?? "default"}
			class={cn(
				menuItemClass,
				"data-inset:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:text-destructive",
				props.class,
			)}
			render={props.as ? renderAs(() => props.as) : props.render}
		/>
	);
}

type CheckboxItemProps = Omit<
	ClassProps<ComponentProps<typeof MenuCheckboxItemPrimitive>>,
	"value" | "onCheckedChange" | "children"
> & {
	value?: string;
	onChange?: (checked: boolean) => void;
	children?: JSX.Element;
};

export function MenuCheckboxItem(props: CheckboxItemProps) {
	const id = createUniqueId();
	return (
		<MenuCheckboxItemPrimitive
			{...omit(props, "class", "value", "onChange", "children")}
			value={props.value ?? id}
			onCheckedChange={props.onChange}
			class={cn(menuItemClass, "pr-2 pl-8", props.class)}
		>
			<span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
				<MenuItemIndicator>
					<Check class="size-4" aria-hidden="true" />
				</MenuItemIndicator>
			</span>
			{props.children}
		</MenuCheckboxItemPrimitive>
	);
}

type MenuRadioGroupProps = ComponentProps<
	typeof MenuRadioGroupPrimitive<string>
> & {
	onChange?: (value: string) => void;
};

export function MenuRadioGroup(props: MenuRadioGroupProps) {
	return (
		<MenuRadioGroupPrimitive
			{...omit(props, "onChange")}
			onValueChange={props.onChange ?? props.onValueChange}
		/>
	);
}

export function MenuRadioItem(
	props: Omit<
		ClassProps<ComponentProps<typeof MenuRadioItemPrimitive>>,
		"children"
	> & { children?: JSX.Element },
) {
	return (
		<MenuRadioItemPrimitive
			{...omit(props, "class", "children")}
			class={cn(menuItemClass, "pr-2 pl-8", props.class)}
		>
			<span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
				<MenuItemIndicator>
					<Circle class="size-2 fill-current" aria-hidden="true" />
				</MenuItemIndicator>
			</span>
			{props.children}
		</MenuRadioItemPrimitive>
	);
}

export function MenuSeparator(
	props: ClassProps<ComponentProps<typeof MenuSeparatorPrimitive>>,
) {
	return (
		<MenuSeparatorPrimitive
			{...omit(props, "class")}
			class={cn("-mx-1 my-1 h-px bg-border", props.class)}
		/>
	);
}

export function MenuGroupLabel(
	props: ClassProps<ComponentProps<typeof MenuGroupLabelPrimitive>>,
) {
	return (
		<MenuGroupLabelPrimitive
			{...omit(props, "class")}
			class={cn("px-2 py-1.5 font-semibold text-sm", props.class)}
		/>
	);
}

export function MenuLabel(props: ComponentProps<"div"> & { inset?: boolean }) {
	return (
		<div
			{...omit(props, "class", "inset")}
			class={cn(
				"px-2 py-1.5 font-semibold text-sm",
				props.inset && "pl-8",
				props.class,
			)}
		/>
	);
}

export function MenuShortcut(props: ComponentProps<"span">) {
	return (
		<span
			{...omit(props, "class")}
			class={cn("ml-auto text-xs tracking-widest opacity-60", props.class)}
		/>
	);
}

export function MenuSubTrigger(
	props: Omit<
		ClassProps<ComponentProps<typeof MenuSubTriggerPrimitive>>,
		"children"
	> & { children?: JSX.Element; inset?: boolean },
) {
	return (
		<MenuSubTriggerPrimitive
			{...omit(props, "class", "children", "inset")}
			data-inset={props.inset ? "" : undefined}
			class={cn(menuItemClass, "data-inset:pl-8", props.class)}
		>
			{props.children}
			<ChevronRight aria-hidden="true" class="ml-auto size-4" />
		</MenuSubTriggerPrimitive>
	);
}

export {
	MenuContent as MenuSubContent,
	MenuGroup,
	MenuSub,
	Portal as MenuPortal,
};
