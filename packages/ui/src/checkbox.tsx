import {
	Control as CheckboxControlPrimitive,
	type CheckboxControlProps as CheckboxControlPropsPrimitive,
	Description as CheckboxDescriptionPrimitive,
	ErrorMessage as CheckboxErrorMessagePrimitive,
	Indicator as CheckboxIndicator,
	Input as CheckboxInput,
	Label as CheckboxLabelPrimitive,
	Root as CheckboxRoot,
} from "@kobalte/core/checkbox";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "./utils/cn";

const Checkbox = CheckboxRoot;

type CheckboxControlProps = CheckboxControlPropsPrimitive & {
	class?: string | undefined;
};

const CheckboxControl = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, CheckboxControlProps>,
) => {
	const [local, others] = splitProps(props as CheckboxControlProps, ["class"]);
	return (
		<>
			<CheckboxInput class="peer" />
			<CheckboxControlPrimitive
				class={cn(
					"peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 data-[checked]:border-none data-[indeterminate]:border-none data-[checked]:bg-primary data-[indeterminate]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:text-primary-foreground",
					local.class,
				)}
				{...others}
			>
				<CheckboxIndicator class="flex items-center justify-center text-current">
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>Checked</title>
						<path d="M5 12l5 5l10 -10" />
					</svg>
				</CheckboxIndicator>
			</CheckboxControlPrimitive>
		</>
	);
};

const CheckboxLabel = CheckboxLabelPrimitive;
const CheckboxDescription = CheckboxDescriptionPrimitive;
const CheckboxErrorMessage = CheckboxErrorMessagePrimitive;

export {
	Checkbox,
	CheckboxControl,
	CheckboxDescription,
	CheckboxErrorMessage,
	CheckboxLabel,
};
