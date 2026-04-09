import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import { Input } from "@solid-imager/ui/input";
import { Label } from "@solid-imager/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@solid-imager/ui/select";
import { createEffect, createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";
import type { MockConnectionInfo, MockSource } from "../mocks/demo-data";

const DEFAULT_SFTP_PORT = 22;

type SourceFormData = {
	connectionInfo: Record<string, string | number | undefined>;
	description: string;
	name: string;
	type: MockSource["type"];
};

type SourceFormModalProps = {
	editingSource?: MockSource | null;
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: {
		connectionInfo: MockConnectionInfo;
		description: string | null;
		name: string;
		type: MockSource["type"];
	}) => void;
};

const emptyFormData = (): SourceFormData => ({
	connectionInfo: {},
	description: "",
	name: "",
	type: "local",
});

export function SourceFormModal(props: SourceFormModalProps) {
	const [formData, setFormData] = createStore<SourceFormData>(emptyFormData());
	const [errors, setErrors] = createSignal<Record<string, string>>({});

	createEffect(() => {
		if (props.editingSource) {
			setFormData({
				connectionInfo: toEditableConnectionInfo(
					props.editingSource.connectionInfo,
				),
				description: props.editingSource.description ?? "",
				name: props.editingSource.name,
				type: props.editingSource.type,
			});
		} else {
			setFormData(emptyFormData());
		}
		setErrors({});
	});

	const validate = () => {
		const nextErrors: Record<string, string> = {};
		if (!formData.name.trim()) {
			nextErrors.name = "Name is required";
		}

		if (formData.type === "local" && !formData.connectionInfo.path) {
			nextErrors.path = "Path is required";
		}
		if (formData.type === "sftp") {
			if (!formData.connectionInfo.host) {
				nextErrors.host = "Host is required";
			}
			if (!formData.connectionInfo.username) {
				nextErrors.username = "Username is required";
			}
			if (!formData.connectionInfo.remotePath) {
				nextErrors.remotePath = "Remote path is required";
			}
		}
		if (formData.type === "s3") {
			if (!formData.connectionInfo.bucket) {
				nextErrors.bucket = "Bucket is required";
			}
			if (!formData.connectionInfo.region) {
				nextErrors.region = "Region is required";
			}
		}

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const submit = (event: Event) => {
		event.preventDefault();
		if (!validate()) {
			return;
		}

		const connectionInfo: MockConnectionInfo =
			formData.type === "local"
				? { path: String(formData.connectionInfo.path ?? "") }
				: formData.type === "sftp"
					? {
							host: String(formData.connectionInfo.host ?? ""),
							port: Number(formData.connectionInfo.port ?? DEFAULT_SFTP_PORT),
							remotePath: String(formData.connectionInfo.remotePath ?? ""),
							username: String(formData.connectionInfo.username ?? ""),
						}
					: {
							bucket: String(formData.connectionInfo.bucket ?? ""),
							prefix:
								String(formData.connectionInfo.prefix ?? "").trim() ||
								undefined,
							region: String(formData.connectionInfo.region ?? ""),
						};

		props.onSubmit({
			connectionInfo,
			description: formData.description.trim() || null,
			name: formData.name.trim(),
			type: formData.type,
		});
	};

	return (
		<Dialog onOpenChange={() => props.onClose()} open={props.isOpen}>
			<DialogContent class="max-h-[80vh] overflow-y-auto sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{props.editingSource ? "Edit Source" : "Add New Source"}
					</DialogTitle>
					<DialogDescription>
						Configure the connection details for your media source.
					</DialogDescription>
				</DialogHeader>

				<form class="space-y-4" onSubmit={submit}>
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

					<div class="space-y-2">
						<Label>Type</Label>
						<Select
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{itemProps.item.rawValue.label}
								</SelectItem>
							)}
							onChange={(value) => {
								setFormData("type", value?.value ?? "local");
								setFormData("connectionInfo", {});
							}}
							options={[
								{ value: "local", label: "Local Filesystem" },
								{ value: "sftp", label: "SFTP" },
								{ value: "s3", label: "S3 Compatible Storage" },
							]}
							value={{
								label:
									formData.type === "local"
										? "Local Filesystem"
										: formData.type === "sftp"
											? "SFTP"
											: "S3 Compatible Storage",
								value: formData.type,
							}}
						>
							<SelectTrigger>
								<SelectValue>
									{(state) =>
										(state.selectedOption() as { label?: string } | undefined)
											?.label ?? "Select type"
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</div>

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
									value={String(formData.connectionInfo.path ?? "")}
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
										value={String(formData.connectionInfo.host ?? "")}
									/>
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
										value={String(
											formData.connectionInfo.port ?? DEFAULT_SFTP_PORT,
										)}
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
									value={String(formData.connectionInfo.username ?? "")}
								/>
							</div>
							<div class="space-y-2">
								<Label for="remote-path">Remote Path</Label>
								<Input
									id="remote-path"
									onInput={(event) =>
										setFormData(
											"connectionInfo",
											"remotePath",
											event.currentTarget.value,
										)
									}
									placeholder="/srv/images"
									value={String(formData.connectionInfo.remotePath ?? "")}
								/>
							</div>
						</Show>

						<Show when={formData.type === "s3"}>
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
									value={String(formData.connectionInfo.bucket ?? "")}
								/>
							</div>
							<div class="grid grid-cols-2 gap-4">
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
										placeholder="ap-northeast-1"
										value={String(formData.connectionInfo.region ?? "")}
									/>
								</div>
								<div class="space-y-2">
									<Label for="prefix">Prefix</Label>
									<Input
										id="prefix"
										onInput={(event) =>
											setFormData(
												"connectionInfo",
												"prefix",
												event.currentTarget.value,
											)
										}
										placeholder="desktop/inbox"
										value={String(formData.connectionInfo.prefix ?? "")}
									/>
								</div>
							</div>
						</Show>
					</div>

					<DialogFooter>
						<Button onClick={props.onClose} type="button" variant="outline">
							Cancel
						</Button>
						<Button type="submit">
							{props.editingSource ? "Save Changes" : "Create Source"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function isLocalConnection(
	connectionInfo: MockConnectionInfo,
): connectionInfo is Extract<MockConnectionInfo, { path: string }> {
	return "path" in connectionInfo;
}

function isSftpConnection(
	connectionInfo: MockConnectionInfo,
): connectionInfo is Extract<
	MockConnectionInfo,
	{ host: string; port: number; remotePath: string; username: string }
> {
	return "host" in connectionInfo;
}

function toEditableConnectionInfo(
	connectionInfo: MockConnectionInfo,
): Record<string, string | number | undefined> {
	if (isLocalConnection(connectionInfo)) {
		return { path: connectionInfo.path };
	}
	if (isSftpConnection(connectionInfo)) {
		return {
			host: connectionInfo.host,
			port: connectionInfo.port,
			remotePath: connectionInfo.remotePath,
			username: connectionInfo.username,
		};
	}
	return {
		bucket: connectionInfo.bucket,
		prefix: connectionInfo.prefix,
		region: connectionInfo.region,
	};
}
