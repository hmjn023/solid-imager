import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import { createForm } from "@tanstack/solid-form";
import { createEffect, Show } from "solid-js";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import {
	FormError,
	FormFieldMessage,
	getFormErrorMessage,
	getFormSubmitError,
} from "./form-message";
import { createSourceFormSchema, type SourceFormValues } from "./form-schemas";
import { Input } from "./input";
import { Label } from "./label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { parseSelectValue } from "./utils/parse-select-value";

const DEFAULT_SFTP_PORT = 22;

export type SourceFormType = "local" | "sftp" | "s3";

export type SourceFormData = {
	name: string;
	description: string;
	type: SourceFormType;
	connectionInfo: Record<string, string | number>;
};

export type SourceFormSubmitData = Omit<
	SourceFormData,
	"connectionInfo" | "description"
> & {
	description: string | null;
	connectionInfo: Record<string, string | number | undefined>;
};

export type SourceFormModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: SourceFormSubmitData) => void | Promise<void>;
	editingSource?: MediaSourceInfo | SafeMediaSource | null;
	initialValues?: SourceFormData;
	sourceTypes?: SourceFormType[];
	description?: string;
	submitLabel?: string;
};

const SOURCE_TYPE_OPTIONS: { value: SourceFormType; label: string }[] = [
	{ value: "local", label: "Local Filesystem" },
	{ value: "sftp", label: "SFTP" },
	{ value: "s3", label: "S3 Compatible Storage" },
];

const SOURCE_TYPE_VALUES = SOURCE_TYPE_OPTIONS.map(
	(option) => option.value,
) as readonly SourceFormType[];

const getTypeLabel = (type: SourceFormType) =>
	SOURCE_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;

function emptySourceFormValues(type: SourceFormType): SourceFormValues {
	return {
		name: "",
		description: "",
		type,
		path: "",
		host: "",
		port: DEFAULT_SFTP_PORT,
		username: "",
		password: "",
		remotePath: "",
		bucket: "",
		region: "",
		accessKeyId: "",
		secretAccessKey: "",
		prefix: "",
	};
}

function valuesFromSource(
	source: MediaSourceInfo | SafeMediaSource,
): SourceFormValues {
	const values = emptySourceFormValues(source.type);
	values.name = source.name;
	values.description = source.description ?? "";
	const connection = source.connectionInfo;
	if ("path" in connection) {
		values.path = connection.path;
	}
	if ("host" in connection) {
		values.host = connection.host;
		values.port = connection.port;
		values.username = connection.username;
		values.password =
			"password" in connection ? (connection.password ?? "") : "";
		values.remotePath = connection.remotePath;
	}
	if ("bucket" in connection) {
		values.bucket = connection.bucket;
		values.region = connection.region;
		values.accessKeyId =
			"accessKeyId" in connection ? connection.accessKeyId : "";
		values.secretAccessKey =
			"secretAccessKey" in connection ? connection.secretAccessKey : "";
		values.prefix = connection.prefix ?? "";
	}
	return values;
}

function valuesFromInitial(
	initial: SourceFormData,
	fallbackType: SourceFormType,
): SourceFormValues {
	const values = emptySourceFormValues(initial.type ?? fallbackType);
	values.name = initial.name;
	values.description = initial.description;
	for (const key of [
		"path",
		"host",
		"username",
		"password",
		"remotePath",
		"bucket",
		"region",
		"accessKeyId",
		"secretAccessKey",
		"prefix",
	] as const) {
		const value = initial.connectionInfo[key];
		values[key] = typeof value === "string" ? value : "";
	}
	const port = initial.connectionInfo.port;
	values.port = typeof port === "number" ? port : DEFAULT_SFTP_PORT;
	return values;
}

export function toSourceFormSubmitData(
	values: SourceFormValues,
): SourceFormSubmitData {
	let connectionInfo: Record<string, string | number | undefined>;
	if (values.type === "local") {
		connectionInfo = { path: values.path };
	} else if (values.type === "sftp") {
		connectionInfo = {
			host: values.host,
			port: values.port,
			username: values.username,
			password: values.password || undefined,
			remotePath: values.remotePath,
		};
	} else {
		connectionInfo = {
			bucket: values.bucket,
			region: values.region,
			accessKeyId: values.accessKeyId || undefined,
			secretAccessKey: values.secretAccessKey || undefined,
			prefix: values.prefix || undefined,
		};
	}
	return {
		name: values.name.trim(),
		description: values.description.trim() || null,
		type: values.type,
		connectionInfo,
	};
}

type SourceTextInputProps = {
	id: string;
	label: string;
	value: string;
	errors: unknown[];
	onBlur: () => void;
	onChange: (value: string) => void;
	placeholder?: string;
	type?: "text" | "password";
};

function SourceTextInput(props: SourceTextInputProps) {
	return (
		<div class="space-y-2">
			<Label for={props.id}>{props.label}</Label>
			<Input
				aria-describedby={`${props.id}-error`}
				aria-invalid={props.errors.length > 0}
				id={props.id}
				onBlur={props.onBlur}
				onInput={(event) => props.onChange(event.currentTarget.value)}
				placeholder={props.placeholder}
				type={props.type ?? "text"}
				value={props.value}
			/>
			<FormFieldMessage
				id={`${props.id}-error`}
				message={getFormErrorMessage(props.errors[0])}
			/>
		</div>
	);
}

export function SourceFormModal(props: SourceFormModalProps) {
	const sourceTypes = () => props.sourceTypes ?? ["local", "sftp", "s3"];
	const defaultValues = () => {
		const fallbackType = sourceTypes()[0] ?? "local";
		if (props.initialValues) {
			return valuesFromInitial(props.initialValues, fallbackType);
		}
		if (props.editingSource) {
			return valuesFromSource(props.editingSource);
		}
		return emptySourceFormValues(fallbackType);
	};
	const form = createForm(() => ({
		defaultValues: defaultValues(),
		validators: {
			onSubmit: createSourceFormSchema(props.editingSource?.type !== "s3"),
		},
		onSubmit: async ({ value }) => {
			form.setErrorMap({ onSubmit: undefined });
			try {
				await props.onSubmit(toSourceFormSubmitData(value));
			} catch (error) {
				form.setErrorMap({
					onSubmit: { form: getErrorMessage(error), fields: {} },
				});
			}
		},
	}));

	let wasOpen = false;
	createEffect(() => {
		const isOpen = props.isOpen;
		if (isOpen && !wasOpen) {
			form.reset(defaultValues());
		}
		wasOpen = isOpen;
	});

	const selectOptions = () =>
		SOURCE_TYPE_OPTIONS.filter((option) =>
			sourceTypes().includes(option.value),
		);
	const fieldError = (errors: unknown[]) => getFormErrorMessage(errors[0]);

	return (
		<Dialog
			onOpenChange={(open) => !open && props.onClose()}
			open={props.isOpen}
		>
			<DialogContent class="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{props.editingSource ? "Edit Source" : "Add New Source"}
					</DialogTitle>
					<DialogDescription>
						{props.description ??
							"Configure the connection details for your media source."}
					</DialogDescription>
				</DialogHeader>

				<form
					class="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void form.handleSubmit();
					}}
				>
					<form.Field name="name">
						{(field) => (
							<div class="space-y-2">
								<Label for={field().name}>Name</Label>
								<Input
									aria-describedby={`${field().name}-error`}
									aria-invalid={field().state.meta.errors.length > 0}
									id={field().name}
									onBlur={field().handleBlur}
									onInput={(event) =>
										field().handleChange(event.currentTarget.value)
									}
									placeholder="My Media Source"
									value={field().state.value}
								/>
								<FormFieldMessage
									id={`${field().name}-error`}
									message={fieldError(field().state.meta.errors)}
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="description">
						{(field) => (
							<div class="space-y-2">
								<Label for={field().name}>Description (Optional)</Label>
								<Input
									id={field().name}
									onBlur={field().handleBlur}
									onInput={(event) =>
										field().handleChange(event.currentTarget.value)
									}
									placeholder="Photos from my camera"
									value={field().state.value}
								/>
							</div>
						)}
					</form.Field>

					<Show when={sourceTypes().length > 1}>
						<form.Field name="type">
							{(field) => (
								<div class="space-y-2">
									<Label>Type</Label>
									<Select
										itemComponent={(itemProps) => (
											<SelectItem item={itemProps.item}>
												{itemProps.item.rawValue.label}
											</SelectItem>
										)}
										onChange={(value) =>
											field().handleChange(
												parseSelectValue(
													value?.value,
													SOURCE_TYPE_VALUES,
													"local",
												),
											)
										}
										options={selectOptions()}
										value={{
											value: field().state.value,
											label: getTypeLabel(field().state.value),
										}}
									>
										<SelectTrigger>
											<SelectValue<{ value: string; label: string }>>
												{(state) => state.selectedOption().label}
											</SelectValue>
										</SelectTrigger>
										<SelectContent />
									</Select>
								</div>
							)}
						</form.Field>
					</Show>

					<form.Subscribe selector={(state) => state.values.type}>
						{(type) => (
							<div class="space-y-4 rounded-md border p-4">
								<h4 class="font-medium text-sm">Connection Details</h4>
								<Show when={type() === "local"}>
									<form.Field name="path">
										{(field) => (
											<SourceTextInput
												errors={field().state.meta.errors}
												id={field().name}
												label="Directory Path"
												onBlur={field().handleBlur}
												onChange={field().handleChange}
												placeholder="/mnt/data/photos"
												value={field().state.value}
											/>
										)}
									</form.Field>
								</Show>
								<Show when={type() === "sftp"}>
									<div class="grid gap-4 sm:grid-cols-2">
										<form.Field name="host">
											{(field) => (
												<SourceTextInput
													errors={field().state.meta.errors}
													id={field().name}
													label="Host"
													onBlur={field().handleBlur}
													onChange={field().handleChange}
													placeholder="192.168.1.10"
													value={field().state.value}
												/>
											)}
										</form.Field>
										<form.Field name="port">
											{(field) => (
												<div class="space-y-2">
													<Label for={field().name}>Port</Label>
													<Input
														aria-describedby={`${field().name}-error`}
														aria-invalid={field().state.meta.errors.length > 0}
														id={field().name}
														min="1"
														onBlur={field().handleBlur}
														onInput={(event) =>
															field().handleChange(
																event.currentTarget.valueAsNumber,
															)
														}
														type="number"
														value={field().state.value}
													/>
													<FormFieldMessage
														id={`${field().name}-error`}
														message={fieldError(field().state.meta.errors)}
													/>
												</div>
											)}
										</form.Field>
									</div>
									<form.Field name="username">
										{(field) => (
											<SourceTextInput
												errors={field().state.meta.errors}
												id={field().name}
												label="Username"
												onBlur={field().handleBlur}
												onChange={field().handleChange}
												placeholder="user"
												value={field().state.value}
											/>
										)}
									</form.Field>
									<form.Field name="password">
										{(field) => (
											<SourceTextInput
												errors={field().state.meta.errors}
												id={field().name}
												label="Password (Optional)"
												onBlur={field().handleBlur}
												onChange={field().handleChange}
												placeholder="********"
												type="password"
												value={field().state.value}
											/>
										)}
									</form.Field>
									<form.Field name="remotePath">
										{(field) => (
											<SourceTextInput
												errors={field().state.meta.errors}
												id={field().name}
												label="Remote Path"
												onBlur={field().handleBlur}
												onChange={field().handleChange}
												placeholder="/home/user/photos"
												value={field().state.value}
											/>
										)}
									</form.Field>
								</Show>
								<Show when={type() === "s3"}>
									<div class="grid gap-4 sm:grid-cols-2">
										<form.Field name="bucket">
											{(field) => (
												<SourceTextInput
													errors={field().state.meta.errors}
													id={field().name}
													label="Bucket"
													onBlur={field().handleBlur}
													onChange={field().handleChange}
													placeholder="my-bucket"
													value={field().state.value}
												/>
											)}
										</form.Field>
										<form.Field name="region">
											{(field) => (
												<SourceTextInput
													errors={field().state.meta.errors}
													id={field().name}
													label="Region"
													onBlur={field().handleBlur}
													onChange={field().handleChange}
													placeholder="us-east-1"
													value={field().state.value}
												/>
											)}
										</form.Field>
									</div>
									<form.Field name="accessKeyId">
										{(field) => (
											<SourceTextInput
												errors={field().state.meta.errors}
												id={field().name}
												label="Access Key ID"
												onBlur={field().handleBlur}
												onChange={field().handleChange}
												placeholder="AKIA..."
												value={field().state.value}
											/>
										)}
									</form.Field>
									<form.Field name="secretAccessKey">
										{(field) => (
											<SourceTextInput
												errors={field().state.meta.errors}
												id={field().name}
												label="Secret Access Key"
												onBlur={field().handleBlur}
												onChange={field().handleChange}
												placeholder="********"
												type="password"
												value={field().state.value}
											/>
										)}
									</form.Field>
									<form.Field name="prefix">
										{(field) => (
											<SourceTextInput
												errors={field().state.meta.errors}
												id={field().name}
												label="Prefix (Optional)"
												onBlur={field().handleBlur}
												onChange={field().handleChange}
												placeholder="photos/"
												value={field().state.value}
											/>
										)}
									</form.Field>
								</Show>
							</div>
						)}
					</form.Subscribe>

					<form.Subscribe selector={(state) => state.errorMap.onSubmit}>
						{(error) => <FormError message={getFormSubmitError(error())} />}
					</form.Subscribe>

					<DialogFooter>
						<Button onClick={props.onClose} type="button" variant="outline">
							Cancel
						</Button>
						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{(state) => (
								<Button
									disabled={!state().canSubmit || state().isSubmitting}
									type="submit"
								>
									{state().isSubmitting
										? "Saving..."
										: (props.submitLabel ??
											(props.editingSource ? "Save Changes" : "Add Source"))}
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
