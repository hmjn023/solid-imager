import {
	Field,
	FieldControl,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@ui-sdk/solid/field";
import { Textarea } from "@ui-sdk/solid/textarea";
import { cva } from "class-variance-authority";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext, omit, useContext } from "solid-js";

import { cn } from "./utils/cn";

type ControllableTextField = {
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	required?: boolean;
	readOnly?: boolean;
};

type ClassProps<Props> = Omit<Props, "class"> & { class?: string };
type TextFieldProps = Omit<
	ClassProps<ComponentProps<typeof Field>>,
	"onChange" | "children"
> &
	ControllableTextField & {
		validationState?: "valid" | "invalid";
		children?: JSX.Element;
	};

const TextFieldContext = createContext<ControllableTextField>({});

function TextField(props: TextFieldProps) {
	return (
		<Field
			{...omit(
				props,
				"class",
				"children",
				"value",
				"defaultValue",
				"onChange",
				"required",
				"readOnly",
				"validationState",
			)}
			class={cn("flex flex-col gap-1", props.class)}
			invalid={
				props.validationState === undefined
					? undefined
					: props.validationState === "invalid"
			}
		>
			<TextFieldContext value={props}>{props.children}</TextFieldContext>
		</Field>
	);
}

type TextFieldInputProps = Omit<
	ClassProps<ComponentProps<typeof FieldControl>>,
	"autocapitalize" | "autocomplete" | "maxlength" | "minlength" | "readonly"
> & {
	autoCapitalize?: ComponentProps<"input">["autocapitalize"];
	autoComplete?: ComponentProps<"input">["autocomplete"];
	maxLength?: number;
	minLength?: number;
	readOnly?: boolean;
	autocapitalize?: ComponentProps<"input">["autocapitalize"];
	autocomplete?: ComponentProps<"input">["autocomplete"];
	maxlength?: number;
	minlength?: number;
	readonly?: boolean;
};

function TextFieldInput(props: TextFieldInputProps) {
	const field = useContext(TextFieldContext);
	return (
		<FieldControl
			{...omit(
				props,
				"class",
				"autoCapitalize",
				"autoComplete",
				"maxLength",
				"minLength",
				"readOnly",
				"onInput",
			)}
			type={props.type ?? "text"}
			value={props.value ?? field.value}
			defaultValue={props.defaultValue ?? field.defaultValue}
			onInput={(event) => {
				const handler = props.onInput;
				if (typeof handler === "function") handler(event);
				else if (handler) handler[0](handler[1], event);
				if (!event.defaultPrevented)
					field.onChange?.(event.currentTarget.value);
			}}
			required={props.required ?? field.required}
			readonly={props.readonly ?? props.readOnly ?? field.readOnly}
			autocapitalize={props.autocapitalize ?? props.autoCapitalize}
			autocomplete={props.autocomplete ?? props.autoComplete}
			maxlength={props.maxlength ?? props.maxLength}
			minlength={props.minlength ?? props.minLength}
			class={cn(
				"flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background transition-colors file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[invalid]:border-error-foreground data-[invalid]:text-error-foreground",
				props.class,
			)}
		/>
	);
}

type TextFieldTextAreaProps = ClassProps<ComponentProps<typeof Textarea>> & {
	maxLength?: number;
	readOnly?: boolean;
};

function TextFieldTextArea(props: TextFieldTextAreaProps) {
	const field = useContext(TextFieldContext);
	return (
		<Textarea
			{...omit(props, "class", "maxLength", "readOnly")}
			value={props.value ?? field.value}
			defaultValue={props.defaultValue ?? field.defaultValue}
			onValueChange={props.onValueChange ?? field.onChange}
			required={props.required ?? field.required}
			readonly={props.readonly ?? props.readOnly ?? field.readOnly}
			maxlength={props.maxlength ?? props.maxLength}
			class={cn(
				"flex min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[invalid]:border-error-foreground data-[invalid]:text-error-foreground",
				props.class,
			)}
		/>
	);
}

const textFieldLabelVariants = cva(
	"font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
	{
		variants: {
			variant: {
				label: "data-[invalid]:text-destructive",
				description: "font-normal text-muted-foreground",
				error: "text-destructive text-xs",
			},
		},
		defaultVariants: {
			variant: "label",
		},
	},
);

type TextFieldLabelProps = ClassProps<ComponentProps<typeof FieldLabel>>;

function TextFieldLabel(props: TextFieldLabelProps) {
	const others = omit(props, "class");
	return (
		<FieldLabel class={cn(textFieldLabelVariants(), props.class)} {...others} />
	);
}

type TextFieldDescriptionProps = ClassProps<
	ComponentProps<typeof FieldDescription>
>;

function TextFieldDescription(props: TextFieldDescriptionProps) {
	const others = omit(props, "class");
	return (
		<FieldDescription
			class={cn(
				textFieldLabelVariants({ variant: "description" }),
				props.class,
			)}
			{...others}
		/>
	);
}

type TextFieldErrorMessageProps = ClassProps<ComponentProps<typeof FieldError>>;

function TextFieldErrorMessage(props: TextFieldErrorMessageProps) {
	const others = omit(props, "class");
	return (
		<FieldError
			class={cn(textFieldLabelVariants({ variant: "error" }), props.class)}
			{...others}
		/>
	);
}

export type {
	TextFieldDescriptionProps,
	TextFieldErrorMessageProps,
	TextFieldInputProps,
	TextFieldLabelProps,
	TextFieldProps,
	TextFieldTextAreaProps,
};
export {
	TextField,
	TextFieldDescription,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
};
