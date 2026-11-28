// Adapted from the Solid UI v2 select registry recipe.
import type { ComponentProps, JSX } from "@solidjs/web";
import { Check, ChevronsUpDown } from "@lucide/solid";
import { FieldDescription, FieldError } from "@ui-sdk/solid/field";
import {
	Select as SelectPrimitiveRoot,
	SelectContent as SelectPrimitiveContent,
	SelectItem as SelectPrimitiveItem,
	SelectItemIndicator,
	SelectItemText,
	SelectLabel as SelectPrimitiveLabel,
	SelectList,
	SelectTrigger as SelectPrimitiveTrigger,
	SelectValue as SelectPrimitiveValue,
} from "@ui-sdk/solid/select";
import { cva } from "class-variance-authority";
import { createContext, For, omit, useContext } from "solid-js";
import { cn } from "./utils/cn";
import {
	popupAlign,
	popupSide,
	type PopupPlacement,
} from "./utils/popup-placement";

type SelectItemData<Option> = {
	rawValue: Option;
	label: string;
	disabled?: boolean;
};
type OptionProperty<Option, Value> = keyof Option | ((option: Option) => Value);
type LegacySelectProps<Option> = {
	children?: JSX.Element;
	options: readonly Option[];
	placeholder?: string;
	optionValue?: OptionProperty<Option, string>;
	optionTextValue?: OptionProperty<Option, string>;
	optionDisabled?: OptionProperty<Option, boolean>;
	disallowEmptySelection?: boolean;
	placement?: PopupPlacement;
	gutter?: number;
	itemComponent?: (props: { item: SelectItemData<Option> }) => JSX.Element;
};
type SelectRootProps<Option> = LegacySelectProps<Option> &
	Omit<ComponentProps<"div">, "children" | "onChange" | "aria-invalid"> & {
		"aria-invalid"?: ComponentProps<"div">["aria-invalid"] | boolean;
	} & Pick<
		ComponentProps<typeof SelectPrimitiveRoot<Option, boolean>>,
		| "open"
		| "defaultOpen"
		| "onOpenChange"
		| "disabled"
		| "readOnly"
		| "required"
		| "name"
		| "form"
	> &
	(
		| {
				multiple?: false;
				value?: Option | null;
				defaultValue?: Option | null;
				onChange?: (option: Option) => void;
		  }
		| {
				multiple: true;
				value?: Option[];
				defaultValue?: Option[];
				onChange?: (options: Option[]) => void;
		  }
	);

const SelectContext = createContext<{
	renderItems: () => JSX.Element;
	placeholder: () => string | undefined;
	position: () => PopupPlacement | undefined;
	gutter: () => number | undefined;
	triggerProps: () => Pick<
		ComponentProps<typeof SelectPrimitiveTrigger>,
		"aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid"
	>;
}>();

function readOption<Option, Value>(
	option: Option,
	property: OptionProperty<Option, Value> | undefined,
) {
	if (typeof property === "function") return property(option);
	if (property !== undefined) return option[property];
}

function Select<Option>(props: SelectRootProps<Option>) {
	function optionKey(option: Option) {
		const key = readOption(option, props.optionValue);
		if (key !== undefined && key !== null) return String(key);
		if (option && typeof option === "object") {
			if ("value" in option) return String(option.value);
			if ("id" in option) return String(option.id);
		}
		return String(option);
	}
	function optionLabel(option: Option) {
		const label = readOption(option, props.optionTextValue);
		if (label !== undefined && label !== null) return String(label);
		return option && typeof option === "object" && "label" in option
			? String(option.label)
			: optionKey(option);
	}
	function optionIsDisabled(option: Option) {
		return Boolean(readOption(option, props.optionDisabled));
	}

	const renderItems = () => (
		<For each={props.options}>
			{(rawValue) => {
				const item = {
					rawValue,
					get label() {
						return optionLabel(rawValue);
					},
					get disabled() {
						return optionIsDisabled(rawValue);
					},
				};
				return (
					props.itemComponent?.({ item }) ?? (
						<SelectItem item={item}>{item.label}</SelectItem>
					)
				);
			}}
		</For>
	);
	return (
		<div
			{...omit(
				props,
				"children",
				"options",
				"placeholder",
				"optionValue",
				"optionTextValue",
				"optionDisabled",
				"itemComponent",
				"disallowEmptySelection",
				"placement",
				"gutter",
				"value",
				"defaultValue",
				"onChange",
				"open",
				"defaultOpen",
				"onOpenChange",
				"multiple",
				"disabled",
				"readOnly",
				"required",
				"name",
				"form",
				"aria-label",
				"aria-labelledby",
				"aria-describedby",
				"aria-invalid",
			)}
		>
			<SelectContext
				value={{
					renderItems,
					placeholder: () => props.placeholder,
					position: () => props.placement,
					gutter: () => props.gutter,
					triggerProps: () => ({
						"aria-label": props["aria-label"],
						"aria-labelledby": props["aria-labelledby"],
						"aria-describedby": props["aria-describedby"],
						"aria-invalid":
							typeof props["aria-invalid"] === "boolean"
								? props["aria-invalid"]
									? "true"
									: "false"
								: props["aria-invalid"],
					}),
				}}
			>
				<SelectPrimitiveRoot<Option, boolean>
					placeholder={props.placeholder}
					itemToValue={optionKey}
					itemToLabel={optionLabel}
					isItemEqualToValue={(option, value) =>
						optionKey(option) === optionKey(value)
					}
					multiple={props.multiple}
					value={props.value}
					defaultValue={props.defaultValue}
					onValueChange={(value, details) => {
						if (value === null && props.disallowEmptySelection) {
							details.cancel();
							return;
						}
						if (props.multiple && Array.isArray(value)) props.onChange?.(value);
						if (!props.multiple && value !== null && !Array.isArray(value))
							props.onChange?.(value);
					}}
					open={props.open}
					defaultOpen={props.defaultOpen}
					onOpenChange={props.onOpenChange}
					name={props.name}
					form={props.form}
					required={props.required}
					disabled={props.disabled}
					readOnly={props.readOnly}
				>
					{props.children}
				</SelectPrimitiveRoot>
			</SelectContext>
		</div>
	);
}

type ClassProps<Props> = Omit<Props, "class" | "children"> & {
	class?: string;
	children?: JSX.Element;
};

function SelectTrigger(
	props: ClassProps<ComponentProps<typeof SelectPrimitiveTrigger>>,
) {
	const context = useContext(SelectContext);
	return (
		<SelectPrimitiveTrigger
			{...context.triggerProps()}
			{...omit(props, "class", "children")}
			class={cn(
				"flex min-h-11 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
				props.class,
			)}
		>
			{props.children ?? <SelectValue />}
			<ChevronsUpDown class="size-4 opacity-50" aria-hidden="true" />
		</SelectPrimitiveTrigger>
	);
}

function SelectContent(
	props: ClassProps<ComponentProps<typeof SelectPrimitiveContent>> & {
		portalMount?: HTMLElement;
	},
) {
	const context = useContext(SelectContext);
	return (
		<SelectPrimitiveContent
			side={popupSide(context.position())}
			align={popupAlign(context.position())}
			sideOffset={context.gutter() ?? 4}
			collisionPadding={props.portalMount ? 16 : undefined}
			alignItemWithTrigger={false}
			{...omit(props, "class", "children", "portalMount")}
			container={props.portalMount ?? props.container}
			class={cn(
				"motion-safe:fade-in-80 z-50 flex max-h-popover-fit-available min-w-32 max-w-viewport-gutter origin-(--transform-origin) flex-col overflow-hidden overscroll-contain rounded-md border bg-popover text-popover-foreground shadow-md motion-safe:data-[closed]:animate-out motion-safe:data-[open]:animate-in motion-safe:data-[closed]:fade-out-0",
				props.class,
			)}
		>
			<SelectList class="m-0 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
				{props.children ?? context.renderItems()}
			</SelectList>
		</SelectPrimitiveContent>
	);
}

function SelectItem<Option>(
	props: Omit<
		ClassProps<ComponentProps<typeof SelectPrimitiveItem<Option>>>,
		"value"
	> & { item: SelectItemData<Option> },
) {
	return (
		<SelectPrimitiveItem<Option>
			{...omit(props, "class", "children", "item")}
			value={props.item.rawValue}
			label={props.item.label}
			disabled={props.disabled ?? props.item.disabled}
			class={cn(
				"relative mt-0 flex min-h-11 w-full cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[highlighted]:bg-muted data-[selected]:font-medium data-[highlighted]:text-foreground data-[disabled]:opacity-50",
				props.class,
			)}
		>
			<SelectItemText
				class="min-w-0 flex-1"
				children={() => props.children ?? props.item.label}
			/>
			<SelectItemIndicator class="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
				<Check class="size-4" aria-hidden="true" />
			</SelectItemIndicator>
		</SelectPrimitiveItem>
	);
}

type SelectValueProps<Option> = Omit<
	ClassProps<ComponentProps<typeof SelectPrimitiveValue>>,
	"children"
> & {
	children?: (state: {
		selectedOption: () => Option;
		selectedOptions: () => Option[];
	}) => JSX.Element;
};

function SelectValue<Option>(props: SelectValueProps<Option>) {
	const context = useContext(SelectContext);
	return (
		<SelectPrimitiveValue
			{...omit(props, "children", "class")}
			class={cn("min-w-0 flex-1 text-left", props.class)}
		>
			{(state) => {
				if (state.placeholder)
					return props.placeholder ?? context.placeholder();
				// The SDK's value slot erases the root's option type. The shared API
				// supplies that same type at the value slot's call site.
				const selected = () =>
					(Array.isArray(state.value)
						? state.value
						: [state.value]) as Option[];
				return (
					props.children?.({
						selectedOption: () => selected()[0],
						selectedOptions: selected,
					}) ?? state.label
				);
			}}
		</SelectPrimitiveValue>
	);
}

const labelVariants = cva(
	"font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
	{
		variants: {
			variant: {
				label: "data-[invalid]:text-destructive",
				description: "font-normal text-muted-foreground",
				error: "text-destructive text-xs",
			},
		},
		defaultVariants: { variant: "label" },
	},
);

function SelectLabel(
	props: ClassProps<ComponentProps<typeof SelectPrimitiveLabel>>,
) {
	return (
		<SelectPrimitiveLabel
			{...omit(props, "class")}
			class={cn(labelVariants(), props.class)}
		/>
	);
}

function SelectDescription(
	props: ClassProps<ComponentProps<typeof FieldDescription>>,
) {
	return (
		<FieldDescription
			{...omit(props, "class")}
			class={cn(labelVariants({ variant: "description" }), props.class)}
		/>
	);
}

function SelectErrorMessage(
	props: ClassProps<ComponentProps<typeof FieldError>>,
) {
	return (
		<FieldError
			{...omit(props, "class")}
			class={cn(labelVariants({ variant: "error" }), props.class)}
		/>
	);
}

// The SDK renders its form input as part of the Select root.
function SelectHiddenSelect() {
	return null;
}

export {
	Select,
	SelectContent,
	SelectDescription,
	SelectErrorMessage,
	SelectHiddenSelect,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
};
