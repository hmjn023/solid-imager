import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { Alert, AlertDescription } from "./alert";
import { cn } from "./utils/cn";

export function getFormErrorMessage(error: unknown): string | undefined {
	if (typeof error === "string") {
		return error;
	}
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}
	return undefined;
}

/** Extracts a form-level message from a nested form error or a direct string/message object. */
export function getFormSubmitError(error: unknown): string | undefined {
	if (typeof error === "object" && error !== null && "form" in error) {
		return getFormErrorMessage(error.form);
	}
	return getFormErrorMessage(error);
}

export type FormFieldMessageProps = {
	id: string;
	message?: string;
	class?: string;
};

/** Accessible validation message shared by form fields. */
export function FormFieldMessage(props: FormFieldMessageProps): JSX.Element {
	return (
		<Show when={props.message}>
			{(message) => (
				<p
					aria-live="polite"
					class={cn("text-destructive text-sm", props.class)}
					id={props.id}
				>
					{message()}
				</p>
			)}
		</Show>
	);
}

export type FormErrorProps = {
	message?: string | null;
	class?: string;
};

/** Form-level error for asynchronous submission and server failures. */
export function FormError(props: FormErrorProps): JSX.Element {
	const renderAlert = (message: string) => (
		<Alert class="bg-destructive/10 p-3" variant="destructive">
			<AlertDescription>{message}</AlertDescription>
		</Alert>
	);

	return (
		<Show when={props.message}>
			{(message) => (
				<Show fallback={renderAlert(message())} when={props.class}>
					{(className) => (
						<div class={className()}>{renderAlert(message())}</div>
					)}
				</Show>
			)}
		</Show>
	);
}
