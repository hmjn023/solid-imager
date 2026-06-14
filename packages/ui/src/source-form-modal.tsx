import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { createEffect, createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
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
	onSubmit: (data: SourceFormSubmitData) => void;
	editingSource?: MediaSourceInfo | SafeMediaSource | null;
	initialValues?: SourceFormData;
	validationRules?: (data: SourceFormData) => Record<string, string>;
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
	(o) => o.value,
) as readonly SourceFormType[];

const getTypeLabel = (type: SourceFormType) =>
	SOURCE_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;

export function defaultSourceFormValidationRules(
	data: SourceFormData,
	editingSource?: MediaSourceInfo | SafeMediaSource | null,
) {
	const errors: Record<string, string> = {};
	if (!data.name.trim()) {
		errors.name = "Name is required";
	}

	if (data.type === "local") {
		if (!data.connectionInfo.path) {
			errors.path = "Path is required";
		}
	} else if (data.type === "sftp") {
		if (!data.connectionInfo.host) {
			errors.host = "Host is required";
		}
		if (!data.connectionInfo.username) {
			errors.username = "Username is required";
		}
		if (!data.connectionInfo.remotePath) {
			errors.remotePath = "Remote path is required";
		}
	} else if (data.type === "s3") {
		if (!data.connectionInfo.bucket) {
			errors.bucket = "Bucket is required";
		}
		if (!data.connectionInfo.region) {
			errors.region = "Region is required";
		}
		if (!editingSource) {
			if (!data.connectionInfo.accessKeyId) {
				errors.accessKeyId = "Access Key ID is required";
			}
			if (!data.connectionInfo.secretAccessKey) {
				errors.secretAccessKey = "Secret Access Key is required";
			}
		}
	}

	return errors;
}

export function SourceFormModal(props: SourceFormModalProps) {
	const sourceTypes = () => props.sourceTypes ?? ["local", "sftp", "s3"];
	const emptyValues = (): SourceFormData => ({
		name: "",
		description: "",
		type: sourceTypes()[0] ?? "local",
		connectionInfo: {},
	});

	const [formData, setFormData] = createStore<SourceFormData>(emptyValues());
	const [errors, setErrors] = createSignal<Record<string, string>>({});

	createEffect(() => {
		if (props.initialValues) {
			setFormData(props.initialValues);
		} else if (props.editingSource) {
			setFormData({
				name: props.editingSource.name,
				description: props.editingSource.description || "",
				type: props.editingSource.type as SourceFormType,
				connectionInfo:
					(props.editingSource.connectionInfo as Record<
						string,
						string | number
					>) || {},
			});
		} else {
			setFormData(emptyValues());
		}
		setErrors({});
	});

	const validate = () => {
		const nextErrors = props.validationRules
			? props.validationRules(formData)
			: defaultSourceFormValidationRules(formData, props.editingSource);

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const handleSubmit = (event: Event) => {
		event.preventDefault();
		if (!validate()) {
			return;
		}
		const connectionInfo: Record<string, string | number | undefined> = {
			...formData.connectionInfo,
			port: formData.connectionInfo.port
				? Number(formData.connectionInfo.port)
				: undefined,
		};

		props.onSubmit({
			...formData,
			description: formData.description || null,
			connectionInfo,
		});
	};

	const selectOptions = () =>
		SOURCE_TYPE_OPTIONS.filter((option) =>
			sourceTypes().includes(option.value),
		);

	return (
		<Dialog onOpenChange={() => props.onClose()} open={props.isOpen}>
			<DialogContent class="max-h-[80vh] overflow-y-auto sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{props.editingSource ? "Edit Source" : "Add New Source"}
					</DialogTitle>
					<DialogDescription>
						{props.description ??
							"Configure the connection details for your media source."}
					</DialogDescription>
				</DialogHeader>

				<form class="space-y-4" onSubmit={handleSubmit}>
					<div class="space-y-2">
						<Label for="name">Name</Label>
						<Input
							id="name"
							onInput={(event) =>
								setFormData("name", event.currentTarget.value)
							}
							placeholder="My Media Source"
							value={formData.name}
						/>
						<Show when={errors().name}>
							<p class="text-red-500 text-sm">{errors().name}</p>
						</Show>
					</div>

					<div class="space-y-2">
						<Label for="description">Description (Optional)</Label>
						<Input
							id="description"
							onInput={(event) =>
								setFormData("description", event.currentTarget.value)
							}
							placeholder="Photos from my camera"
							value={formData.description}
						/>
					</div>

					<Show when={sourceTypes().length > 1}>
						<div class="space-y-2">
							<Label>Type</Label>
							<Select
								itemComponent={(itemProps) => (
									<SelectItem item={itemProps.item}>
										{itemProps.item.rawValue.label}
									</SelectItem>
								)}
								onChange={(value) =>
									setFormData(
										"type",
										parseSelectValue(value?.value, SOURCE_TYPE_VALUES, "local"),
									)
								}
								options={selectOptions()}
								value={{
									value: formData.type,
									label: getTypeLabel(formData.type),
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
					</Show>

					<div class="space-y-4 rounded-md border p-4">
						<h4 class="font-medium text-sm">Connection Details</h4>

						<Show when={formData.type === "local"}>
							<div class="space-y-2">
								<Label for="path">Directory Path</Label>
								<Input
									id="path"
									onInput={(event) =>
										setFormData(
											"connectionInfo",
											"path",
											event.currentTarget.value,
										)
									}
									placeholder="/mnt/data/photos"
									value={(formData.connectionInfo.path as string) || ""}
								/>
								<Show when={errors().path}>
									<p class="text-red-500 text-sm">{errors().path}</p>
								</Show>
							</div>
						</Show>

						<Show when={formData.type === "sftp"}>
							<div class="grid grid-cols-2 gap-4">
								<div class="space-y-2">
									<Label for="host">Host</Label>
									<Input
										id="host"
										onInput={(event) =>
											setFormData(
												"connectionInfo",
												"host",
												event.currentTarget.value,
											)
										}
										placeholder="192.168.1.10"
										value={(formData.connectionInfo.host as string) || ""}
									/>
									<Show when={errors().host}>
										<p class="text-red-500 text-sm">{errors().host}</p>
									</Show>
								</div>
								<div class="space-y-2">
									<Label for="port">Port</Label>
									<Input
										id="port"
										onInput={(event) =>
											setFormData(
												"connectionInfo",
												"port",
												event.currentTarget.value,
											)
										}
										placeholder="22"
										type="number"
										value={formData.connectionInfo.port || DEFAULT_SFTP_PORT}
									/>
								</div>
							</div>
							<div class="space-y-2">
								<Label for="username">Username</Label>
								<Input
									id="username"
									onInput={(event) =>
										setFormData(
											"connectionInfo",
											"username",
											event.currentTarget.value,
										)
									}
									placeholder="user"
									value={(formData.connectionInfo.username as string) || ""}
								/>
								<Show when={errors().username}>
									<p class="text-red-500 text-sm">{errors().username}</p>
								</Show>
							</div>
							<div class="space-y-2">
								<Label for="password">Password (Optional)</Label>
								<Input
									id="password"
									onInput={(event) =>
										setFormData(
											"connectionInfo",
											"password",
											event.currentTarget.value,
										)
									}
									placeholder="********"
									type="password"
									value={(formData.connectionInfo.password as string) || ""}
								/>
							</div>
							<div class="space-y-2">
								<Label for="remotePath">Remote Path</Label>
								<Input
									id="remotePath"
									onInput={(event) =>
										setFormData(
											"connectionInfo",
											"remotePath",
											event.currentTarget.value,
										)
									}
									placeholder="/home/user/photos"
									value={(formData.connectionInfo.remotePath as string) || ""}
								/>
								<Show when={errors().remotePath}>
									<p class="text-red-500 text-sm">{errors().remotePath}</p>
								</Show>
							</div>
						</Show>

						<Show when={formData.type === "s3"}>
							<div class="grid grid-cols-2 gap-4">
								<div class="space-y-2">
									<Label for="bucket">Bucket</Label>
									<Input
										id="bucket"
										onInput={(event) =>
											setFormData(
												"connectionInfo",
												"bucket",
												event.currentTarget.value,
											)
										}
										placeholder="my-bucket"
										value={(formData.connectionInfo.bucket as string) || ""}
									/>
									<Show when={errors().bucket}>
										<p class="text-red-500 text-sm">{errors().bucket}</p>
									</Show>
								</div>
								<div class="space-y-2">
									<Label for="region">Region</Label>
									<Input
										id="region"
										onInput={(event) =>
											setFormData(
												"connectionInfo",
												"region",
												event.currentTarget.value,
											)
										}
										placeholder="us-east-1"
										value={(formData.connectionInfo.region as string) || ""}
									/>
									<Show when={errors().region}>
										<p class="text-red-500 text-sm">{errors().region}</p>
									</Show>
								</div>
							</div>
							<div class="space-y-2">
								<Label for="accessKeyId">Access Key ID</Label>
								<Input
									id="accessKeyId"
									onInput={(event) =>
										setFormData(
											"connectionInfo",
											"accessKeyId",
											event.currentTarget.value,
										)
									}
									placeholder="AKIA..."
									value={(formData.connectionInfo.accessKeyId as string) || ""}
								/>
								<Show when={errors().accessKeyId}>
									<p class="text-red-500 text-sm">{errors().accessKeyId}</p>
								</Show>
							</div>
							<div class="space-y-2">
								<Label for="secretAccessKey">Secret Access Key</Label>
								<Input
									id="secretAccessKey"
									onInput={(event) =>
										setFormData(
											"connectionInfo",
											"secretAccessKey",
											event.currentTarget.value,
										)
									}
									placeholder="********"
									type="password"
									value={
										(formData.connectionInfo.secretAccessKey as string) || ""
									}
								/>
								<Show when={errors().secretAccessKey}>
									<p class="text-red-500 text-sm">{errors().secretAccessKey}</p>
								</Show>
							</div>
							<div class="space-y-2">
								<Label for="prefix">Prefix (Optional)</Label>
								<Input
									id="prefix"
									onInput={(event) =>
										setFormData(
											"connectionInfo",
											"prefix",
											event.currentTarget.value,
										)
									}
									placeholder="photos/"
									value={(formData.connectionInfo.prefix as string) || ""}
								/>
							</div>
						</Show>
					</div>

					<DialogFooter>
						<Button
							onClick={() => props.onClose()}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button type="submit">
							{props.submitLabel ??
								(props.editingSource ? "Save Changes" : "Add Source")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
