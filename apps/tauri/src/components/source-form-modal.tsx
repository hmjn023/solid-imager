import type { MediaSourceInfo, SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
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
import { createEffect, createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";

type SourceFormModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: any) => void;
	editingSource?: MediaSourceInfo | SafeMediaSource | null;
};

export function SourceFormModal(props: SourceFormModalProps) {
	const [formData, setFormData] = createStore<{
		name: string;
		description: string;
		type: "local";
		connectionInfo: {
			path: string;
		};
	}>({
		name: "",
		description: "",
		type: "local",
		connectionInfo: {
			path: "",
		},
	});

	const [errors, setErrors] = createSignal<Record<string, string>>({});

	createEffect(() => {
		if (props.editingSource) {
			setFormData({
				name: props.editingSource.name,
				description: props.editingSource.description || "",
				type: "local",
				connectionInfo: {
					path: (props.editingSource.connectionInfo as { path?: string }).path || "",
				},
			});
		} else {
			setFormData({
				name: "",
				description: "",
				type: "local",
				connectionInfo: {
					path: "",
				},
			});
		}
		setErrors({});
	});

	const validate = () => {
		const nextErrors: Record<string, string> = {};
		if (!formData.name.trim()) {
			nextErrors.name = "Name is required";
		}
		if (!formData.connectionInfo.path.trim()) {
			nextErrors.path = "Path is required";
		}
		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const handleSubmit = (event: Event) => {
		event.preventDefault();
		if (!validate()) {
			return;
		}
		props.onSubmit({
			name: formData.name,
			description: formData.description || null,
			type: "local",
			connectionInfo: {
				path: formData.connectionInfo.path,
			},
		});
	};

	return (
		<Dialog onOpenChange={() => props.onClose()} open={props.isOpen}>
			<DialogContent class="max-h-[80vh] overflow-y-auto sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{props.editingSource ? "Edit Source" : "Add New Source"}</DialogTitle>
					<DialogDescription>
						Tauri currently supports local filesystem sources only.
					</DialogDescription>
				</DialogHeader>

				<form class="space-y-4" onSubmit={handleSubmit}>
					<div class="space-y-2">
						<Label for="name">Name</Label>
						<Input
							id="name"
							onInput={(event) => setFormData("name", event.currentTarget.value)}
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
							onInput={(event) => setFormData("description", event.currentTarget.value)}
							placeholder="Photos from my camera"
							value={formData.description}
						/>
					</div>

					<div class="space-y-2 rounded-md border p-4">
						<Label for="path">Directory Path</Label>
						<Input
							id="path"
							onInput={(event) => setFormData("connectionInfo", "path", event.currentTarget.value)}
							placeholder="/mnt/data/photos"
							value={formData.connectionInfo.path}
						/>
						<Show when={errors().path}>
							<p class="text-red-500 text-sm">{errors().path}</p>
						</Show>
					</div>

					<DialogFooter>
						<Button onClick={() => props.onClose()} type="button" variant="outline">
							Cancel
						</Button>
						<Button type="submit">{props.editingSource ? "Save Changes" : "Create Source"}</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
