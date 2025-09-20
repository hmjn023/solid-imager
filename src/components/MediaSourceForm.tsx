import { createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import type { mediaSourceInfo, mediaSourceTypeEnum } from "~/lib/types";

interface MediaSourceFormProps {
	initialData?: mediaSourceInfo;
	onSubmit: (data: mediaSourceInfo) => void;
	onCancel: () => void;
}

export default function MediaSourceForm(props: MediaSourceFormProps) {
	const [name, setName] = createSignal(props.initialData?.name || "");
	const [description, setDescription] = createSignal(
		props.initialData?.description || "",
	);
	const [type, setType] = createSignal<mediaSourceTypeEnum>(
		props.initialData?.type || "local",
	);
	const [path, setPath] = createSignal(
		props.initialData?.connectionInfo.path || "",
	);

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		props.onSubmit({
			name: name(),
			description: description(),
			type: type(),
			connectionInfo: { path: path() },
		});
	};

	return (
		<form onSubmit={handleSubmit} class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="name" class="text-right">
					Name
				</Label>
				<Input
					id="name"
					value={name()}
					onInput={(e) => setName(e.currentTarget.value)}
					class="col-span-3"
					required
				/>
			</div>
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="description" class="text-right">
					Description
				</Label>
				<Input
					id="description"
					value={description()}
					onInput={(e) => setDescription(e.currentTarget.value)}
					class="col-span-3"
				/>
			</div>
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="type" class="text-right">
					Type
				</Label>
				<Select
					value={type()}
					onValueChange={(value) => setType(value as mediaSourceTypeEnum)}
				>
					<SelectTrigger class="col-span-3">
						<SelectValue placeholder="Select a type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="local">Local</SelectItem>
						<SelectItem value="sftp">SFTP</SelectItem>
						<SelectItem value="s3">S3</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="path" class="text-right">
					Path
				</Label>
				<Input
					id="path"
					value={path()}
					onInput={(e) => setPath(e.currentTarget.value)}
					class="col-span-3"
					required
				/>
			</div>
			<div class="flex justify-end gap-2 mt-4">
				<Button type="button" variant="outline" onClick={props.onCancel}>
					Cancel
				</Button>
				<Button type="submit">Save</Button>
			</div>
		</form>
	);
}
