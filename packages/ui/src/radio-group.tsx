// Adapted from the Solid UI v2 radio-group registry recipe.
import type { ComponentProps } from "@solidjs/web";
import { Field, FieldLabel } from "@ui-sdk/solid/field";
import {
	Radio,
	RadioGroup as RadioGroupPrimitive,
	RadioIndicator,
} from "@ui-sdk/solid/radio";
import { omit } from "solid-js";
import { cn } from "./utils/cn";

type RadioGroupProps = Omit<
	ComponentProps<typeof RadioGroupPrimitive<string>>,
	"class" | "onChange" | "onValueChange"
> & {
	class?: string;
	onChange?: (value: string) => void;
};

function RadioGroup(props: RadioGroupProps) {
	return (
		<RadioGroupPrimitive
			{...omit(props, "class", "onChange")}
			class={cn("grid gap-2", props.class)}
			onValueChange={(value) => {
				if (value !== null) props.onChange?.(value);
			}}
		/>
	);
}

type RadioGroupItemProps = Omit<
	ComponentProps<typeof Field>,
	"class" | "children"
> & {
	class?: string;
	children?: import("@solidjs/web").JSX.Element;
	value: string;
	disabled?: boolean;
};

function RadioGroupItem(props: RadioGroupItemProps) {
	return (
		<Field
			{...omit(props, "class", "children", "value")}
			class={cn("flex items-center space-x-2", props.class)}
		>
			<Radio
				value={props.value}
				disabled={props.disabled}
				class="peer relative aspect-square size-4 shrink-0 rounded-full border border-primary text-primary ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-disabled:cursor-not-allowed data-disabled:opacity-50"
			>
				<RadioIndicator class="flex h-full items-center justify-center">
					<span class="size-2.5 rounded-full bg-current" aria-hidden="true" />
				</RadioIndicator>
			</Radio>
			{props.children}
		</Field>
	);
}

function RadioGroupItemLabel(
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

export { RadioGroup, RadioGroupItem, RadioGroupItemLabel };
