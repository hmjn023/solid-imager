import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
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

const DEFAULT_SFTP_PORT = 22;

type SourceFormModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: any) => void;
	editingSource?: MediaSourceInfo | SafeMediaSource | null;
};

export default function SourceFormModal(props: SourceFormModalProps) {
	const [formData, setFormData] = createStore<{
		name: string;
		description: string;
		type: "local" | "sftp" | "s3";
		connectionInfo: Record<string, string | number>;
	}>({
		name: "",
		description: "",
		type: "local",
		connectionInfo: {},
	});

	const [errors, setErrors] = createSignal<Record<string, string>>({});

	createEffect(() => {
		if (props.editingSource) {
			setFormData({
				name: props.editingSource.name,
				description: props.editingSource.description || "",
				type: props.editingSource.type as "local" | "sftp" | "s3",
				connectionInfo: (props.editingSource.connectionInfo as any) || {},
			});
		} else {
			setFormData({
				name: "",
				description: "",
				type: "local",
				connectionInfo: {},
			});
		}
		setErrors({});
	});

	const validate = () => {
		const newErrors: Record<string, string> = {};
		if (!formData.name.trim()) {
			newErrors.name = "Name is required";
		}

		if (formData.type === "local") {
			if (!formData.connectionInfo.path) {
				newErrors.path = "Path is required";
			}
		} else if (formData.type === "sftp") {
			if (!formData.connectionInfo.host) {
				newErrors.host = "Host is required";
			}
			if (!formData.connectionInfo.username) {
				newErrors.username = "Username is required";
			}
			if (!formData.connectionInfo.remotePath) {
				newErrors.remotePath = "Remote path is required";
			}
		} else if (formData.type === "s3") {
			if (!formData.connectionInfo.bucket) {
				newErrors.bucket = "Bucket is required";
			}
			if (!formData.connectionInfo.region) {
				newErrors.region = "Region is required";
			}
			// AccessKey/SecretKey are optional on edit if not changing
			if (!props.editingSource) {
				if (!formData.connectionInfo.accessKeyId) {
					newErrors.accessKeyId = "Access Key ID is required";
				}
				if (!formData.connectionInfo.secretAccessKey) {
					newErrors.secretAccessKey = "Secret Access Key is required";
				}
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		if (validate()) {
			props.onSubmit({
				...formData,
				description: formData.description || null,
				connectionInfo: {
					...formData.connectionInfo,
					// Ensure port is number for SFTP
					port: formData.connectionInfo.port
						? Number(formData.connectionInfo.port)
						: undefined,
				},
			});
		}
	};

	const getTypeLabel = (type: string) => {
		if (type === "local") {
			return "Local Filesystem";
		}
		if (type === "sftp") {
			return "SFTP";
		}
		if (type === "s3") {
			return "S3 Compatible Storage";
		}
		return type;
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

				<form class="space-y-4" onSubmit={handleSubmit}>
					<div class="space-y-2">
						<Label for="name">Name</Label>
						<Input
							id="name"
							onInput={(e) => setFormData("name", e.currentTarget.value)}
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
							onInput={(e) => setFormData("description", e.currentTarget.value)}
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
							onChange={(v) =>
								setFormData("type", v?.value as "local" | "sftp" | "s3")
							}
							options={[
								{ value: "local", label: "Local Filesystem" },
								{ value: "sftp", label: "SFTP" },
								{ value: "s3", label: "S3 Compatible Storage" },
							]}
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

					<div class="space-y-4 rounded-md border p-4">
						<h4 class="font-medium text-sm">Connection Details</h4>

						<Show when={formData.type === "local"}>
							<div class="space-y-2">
								<Label for="path">Directory Path</Label>
								<Input
									id="path"
									onInput={(e) =>
										setFormData("connectionInfo", "path", e.currentTarget.value)
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
										onInput={(e) =>
											setFormData(
												"connectionInfo",
												"host",
												e.currentTarget.value,
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
										onInput={(e) =>
											setFormData(
												"connectionInfo",
												"port",
												e.currentTarget.value,
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
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"username",
											e.currentTarget.value,
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
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"password",
											e.currentTarget.value,
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
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"remotePath",
											e.currentTarget.value,
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
										onInput={(e) =>
											setFormData(
												"connectionInfo",
												"bucket",
												e.currentTarget.value,
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
										onInput={(e) =>
											setFormData(
												"connectionInfo",
												"region",
												e.currentTarget.value,
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
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"accessKeyId",
											e.currentTarget.value,
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
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"secretAccessKey",
											e.currentTarget.value,
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
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"prefix",
											e.currentTarget.value,
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
							{props.editingSource ? "Save Changes" : "Add Source"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
