import type { ComponentProps } from "@solidjs/web";
import {
	Checkbox as CheckboxPrimitive,
	CheckboxIndicator,
} from "@ui-sdk/solid/checkbox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@ui-sdk/solid/field";
import { createContext, omit, useContext } from "solid-js";
import { Check, Minus } from "@lucide/solid";
import { cn } from "./utils/cn";

type CheckboxOptions = Pick<
	ComponentProps<typeof CheckboxPrimitive>,
	| "checked"
	| "defaultChecked"
	| "disabled"
	| "name"
	| "readOnly"
	| "required"
	| "value"
>;
type CheckboxProps = CheckboxOptions &
	Omit<ComponentProps<typeof Field>, "onChange" | "children"> & {
		children?: import("@solidjs/web").JSX.Element;
		indeterminate?: boolean;
		validationState?: "valid" | "invalid";
		onChange?: (checked: boolean) => void;
	};

const CheckboxContext = createContext<CheckboxProps>();

function Checkbox(props: CheckboxProps) {
	return (
		<Field
			{...omit(
				props,
				"checked",
				"defaultChecked",
				"indeterminate",
				"onChange",
				"readOnly",
				"required",
				"validationState",
				"value",
			)}
			invalid={props.validationState === "invalid"}
			data-checked={props.checked || undefined}
			data-disabled={props.disabled || undefined}
		>
			<CheckboxContext value={props}>{props.children}</CheckboxContext>
		</Field>
	);
}

type CheckboxControlProps = Omit<
	ComponentProps<typeof CheckboxPrimitive>,
	"checked" | "defaultChecked" | "onCheckedChange" | "class"
> & {
	class?: string;
};

function CheckboxControl(props: CheckboxControlProps) {
	const control = useContext(CheckboxContext);
	return (
		<CheckboxPrimitive
			{...omit(props, "class")}
			checked={control.indeterminate ? "indeterminate" : control.checked}
			defaultChecked={control.defaultChecked}
			disabled={control.disabled}
			readOnly={control.readOnly}
			required={control.required}
			value={control.value}
			onCheckedChange={(checked) => control.onChange?.(checked === true)}
			class={cn(
				"peer block size-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-none data-[indeterminate]:border-none data-[checked]:bg-primary data-[indeterminate]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:text-primary-foreground",
				props.class,
			)}
		>
			<CheckboxIndicator class="flex items-center justify-center text-current">
				{(state) =>
					state.indeterminate ? (
						<Minus class="size-4" aria-hidden="true" />
					) : (
						<Check class="size-4" aria-hidden="true" />
					)
				}
			</CheckboxIndicator>
		</CheckboxPrimitive>
	);
}

export {
	Checkbox,
	CheckboxControl,
	FieldDescription as CheckboxDescription,
	FieldError as CheckboxErrorMessage,
	FieldLabel as CheckboxLabel,
};
