import type { PolymorphicProps } from "@kobalte/core";
import {
	Control as SwitchControlPrimitive,
	type SwitchControlProps as SwitchControlPropsPrimitive,
	Description as SwitchDescriptionPrimitive,
	ErrorMessage as SwitchErrorMessagePrimitive,
	Input as SwitchInput,
	Label as SwitchLabelPrimitive,
	type SwitchLabelProps as SwitchLabelPropsPrimitive,
	Root as SwitchRoot,
	Thumb as SwitchThumbPrimitive,
	type SwitchThumbProps as SwitchThumbPropsPrimitive,
} from "@kobalte/core/switch";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "./utils/cn";

const Switch = SwitchRoot;
const SwitchDescription = SwitchDescriptionPrimitive;
const SwitchErrorMessage = SwitchErrorMessagePrimitive;

type SwitchControlProps = SwitchControlPropsPrimitive & {
	class?: string | undefined;
	children?: JSX.Element;
};

const SwitchControl = <T extends ValidComponent = "input">(
	props: PolymorphicProps<T, SwitchControlProps>,
) => {
	const [local, others] = splitProps(props as SwitchControlProps, ["class", "children"]);
	return (
		<>
			<SwitchInput
				class={cn(
					"[&:focus-visible+div]:outline-none [&:focus-visible+div]:ring-2 [&:focus-visible+div]:ring-ring [&:focus-visible+div]:ring-offset-2 [&:focus-visible+div]:ring-offset-background",
					local.class,
				)}
			/>
			<SwitchControlPrimitive
				class={cn(
					"inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-[color,background-color,box-shadow] data-[disabled]:cursor-not-allowed data-[checked]:bg-primary data-[disabled]:opacity-50",
					local.class,
				)}
				{...others}
			>
				{local.children}
			</SwitchControlPrimitive>
		</>
	);
};

type SwitchThumbProps = SwitchThumbPropsPrimitive & {
	class?: string | undefined;
};

const SwitchThumb = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, SwitchThumbProps>,
) => {
	const [local, others] = splitProps(props as SwitchThumbProps, ["class"]);
	return (
		<SwitchThumbPrimitive
			class={cn(
				"pointer-events-none block size-5 translate-x-0 rounded-full bg-background shadow-lg ring-0 transition-transform data-[checked]:translate-x-5",
				local.class,
			)}
			{...others}
		/>
	);
};

type SwitchLabelProps = SwitchLabelPropsPrimitive & {
	class?: string | undefined;
};

const SwitchLabel = <T extends ValidComponent = "label">(
	props: PolymorphicProps<T, SwitchLabelProps>,
) => {
	const [local, others] = splitProps(props as SwitchLabelProps, ["class"]);
	return (
		<SwitchLabelPrimitive
			class={cn(
				"font-medium text-sm leading-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70",
				local.class,
			)}
			{...others}
		/>
	);
};

export { Switch, SwitchControl, SwitchDescription, SwitchErrorMessage, SwitchLabel, SwitchThumb };
