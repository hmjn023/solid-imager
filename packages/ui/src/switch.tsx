import type { ComponentProps } from "@solidjs/web";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@ui-sdk/solid/field";
import {
	Switch as SwitchPrimitive,
	SwitchThumb as SwitchThumbPrimitive,
} from "@ui-sdk/solid/switch";
import { createContext, omit, useContext } from "solid-js";
import { cn } from "./utils/cn";

type SwitchOptions = Pick<
	ComponentProps<typeof SwitchPrimitive>,
	| "checked"
	| "defaultChecked"
	| "disabled"
	| "name"
	| "readOnly"
	| "required"
	| "value"
>;
type SwitchProps = SwitchOptions &
	Omit<ComponentProps<typeof Field>, "onChange" | "children"> & {
		children?: import("@solidjs/web").JSX.Element;
		onChange?: (checked: boolean) => void;
		validationState?: "valid" | "invalid";
	};

const SwitchContext = createContext<SwitchProps>();

function Switch(props: SwitchProps) {
	return (
		<Field
			{...omit(
				props,
				"checked",
				"defaultChecked",
				"onChange",
				"readOnly",
				"required",
				"value",
				"validationState",
			)}
			invalid={props.validationState === "invalid"}
			data-checked={props.checked || undefined}
		>
			<SwitchContext value={props}>{props.children}</SwitchContext>
		</Field>
	);
}

type SwitchControlProps = Omit<
	ComponentProps<typeof SwitchPrimitive>,
	"checked" | "defaultChecked" | "onCheckedChange" | "class"
> & {
	class?: string;
};

function SwitchControl(props: SwitchControlProps) {
	const control = useContext(SwitchContext);
	return (
		<SwitchPrimitive
			{...omit(props, "class")}
			checked={control.checked}
			defaultChecked={control.defaultChecked}
			disabled={control.disabled}
			name={control.name}
			readOnly={control.readOnly}
			required={control.required}
			value={control.value}
			onCheckedChange={control.onChange}
			class={cn(
				"inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[disabled]:cursor-not-allowed data-[checked]:bg-primary data-[disabled]:opacity-50",
				props.class,
			)}
		/>
	);
}

function SwitchThumb(
	props: Omit<ComponentProps<typeof SwitchThumbPrimitive>, "class"> & {
		class?: string;
	},
) {
	return (
		<SwitchThumbPrimitive
			{...omit(props, "class")}
			class={cn(
				"pointer-events-none block size-5 translate-x-0 rounded-full bg-background shadow-lg ring-0 transition-transform data-[checked]:translate-x-5",
				props.class,
			)}
		/>
	);
}

function SwitchLabel(
	props: Omit<ComponentProps<typeof FieldLabel>, "class"> & { class?: string },
) {
	return (
		<FieldLabel
			{...omit(props, "class")}
			class={cn(
				"font-medium text-sm leading-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70",
				props.class,
			)}
		/>
	);
}

export {
	Switch,
	SwitchControl,
	FieldDescription as SwitchDescription,
	FieldError as SwitchErrorMessage,
	SwitchLabel,
	SwitchThumb,
};
