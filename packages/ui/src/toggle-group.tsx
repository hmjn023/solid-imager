// Adapted from the Solid UI v2 toggle-group registry recipe.
import type { ComponentProps, JSX, ValidComponent } from "@solidjs/web";
import { ToggleGroup as SdkToggleGroup } from "@ui-sdk/solid/toggle";
import type { VariantProps } from "class-variance-authority";
import { createContext, createMemo, omit, useContext } from "solid-js";

import { Toggle, type ToggleProps, type toggleVariants } from "./toggle";
import { cn } from "./utils/cn";
import type { PolymorphicProps } from "./utils/polymorphic";

type ToggleGroupOptions =
	| {
			multiple?: false;
			value?: string | null;
			defaultValue?: string;
			onChange?: (value: string | null) => void;
	  }
	| {
			multiple: true;
			value?: string[];
			defaultValue?: string[];
			onChange?: (value: string[]) => void;
	  };

type ToggleVariants = VariantProps<typeof toggleVariants>;

const ToggleGroupContext = createContext<ToggleVariants>({});

type ToggleGroupProps = ToggleGroupOptions &
	ToggleVariants &
	Omit<
		ComponentProps<typeof SdkToggleGroup<string>>,
		| "class"
		| "children"
		| "value"
		| "defaultValue"
		| "onValueChange"
		| "deselectable"
	> & {
		class?: string;
		children?: JSX.Element;
		disallowEmptySelection?: boolean;
	};

function groupValues(value: string | string[] | null | undefined): string[] {
	if (Array.isArray(value)) return value;
	return typeof value === "string" ? [value] : [];
}

function ToggleGroup(props: ToggleGroupProps) {
	const value = createMemo(() =>
		props.value === undefined ? undefined : groupValues(props.value),
	);
	const defaultValue = groupValues(props.defaultValue);
	let uncontrolledSelection = defaultValue;
	const orientation = () => props.orientation ?? "horizontal";
	const variants: ToggleVariants = {
		get size() {
			return props.size;
		},
		get variant() {
			return props.variant;
		},
	};
	return (
		<SdkToggleGroup
			{...omit(
				props,
				"class",
				"children",
				"size",
				"variant",
				"value",
				"defaultValue",
				"onChange",
				"orientation",
				"disallowEmptySelection",
			)}
			data-toggle-group=""
			aria-disabled={props.disabled ? "true" : undefined}
			class={cn(
				"flex items-center justify-center gap-1",
				orientation() === "vertical" && "flex-col",
				props.class,
			)}
			orientation={orientation()}
			value={value()}
			defaultValue={props.value === undefined ? defaultValue : undefined}
			deselectable={!props.disallowEmptySelection}
			onValueChange={(selection, details) => {
				if (props.disallowEmptySelection && selection.length === 0) {
					details.cancel();
					return;
				}
				// Controlled callers can decline the change by leaving value unchanged.
				if (props.value !== undefined) details.cancel();
				if (props.multiple) {
					const previous = props.value ?? uncontrolledSelection;
					const next = [
						...previous.filter((item) => selection.includes(item)),
						...selection.filter((item) => !previous.includes(item)),
					];
					if (props.value === undefined) uncontrolledSelection = next;
					props.onChange?.(next);
				} else {
					props.onChange?.(selection[0] ?? null);
				}
			}}
		>
			<ToggleGroupContext value={variants}>{props.children}</ToggleGroupContext>
		</SdkToggleGroup>
	);
}

type ToggleGroupItemProps = Omit<
	ToggleProps,
	"pressed" | "defaultPressed" | "onChange"
> & { value: string };

function ToggleGroupItem<T extends ValidComponent = "button">(
	props: PolymorphicProps<T, ToggleGroupItemProps>,
) {
	const context = useContext(ToggleGroupContext);
	return (
		<Toggle
			{...omit(props as ToggleGroupItemProps, "size", "variant")}
			data-toggle-group-item=""
			size={context.size || props.size}
			variant={context.variant || props.variant}
		/>
	);
}

export { ToggleGroup, ToggleGroupItem };
