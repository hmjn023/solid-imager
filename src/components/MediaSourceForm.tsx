import { createForm } from "@tanstack/solid-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { For, Show } from "solid-js";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { mediaSourceSchema } from "../lib/schemas";
import type { mediaSourceInfo, mediaSourceTypeEnum } from "../lib/types";

interface MediaSourceFormProps {
	initialData?: mediaSourceInfo;
	onSubmit: (data: mediaSourceInfo) => void;
	onCancel: () => void;
}

export default function MediaSourceForm(props: MediaSourceFormProps) {
	const form = createForm(() => ({
		defaultValues: props.initialData || {
			name: "",
			description: "",
			type: "local",
			connectionInfo: { path: "" },
		},
		onSubmit: async ({ value }) => {
			// HACK: zodのスキーマに合わせるため、descriptionがundefinedの場合は空文字に変換
			const submitData = {
				...value,
				description: value.description ?? "",
			};
			props.onSubmit(submitData);
		},
		validatorAdapter: zodValidator,
	}));

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			class="grid gap-4 py-4"
		>
			<form.Field
				name="name"
				validators={{
					onChange: mediaSourceSchema.shape.name,
				}}
				children={(field) => (
					<div class="grid grid-cols-4 items-center gap-4">
						<Label for={field().name} class="text-right">
							Name
						</Label>
						<div class="col-span-3">
							<Input
								id={field().name}
								name={field().name}
								value={field().state.value}
								onBlur={field().handleBlur}
								onInput={(e) => field().handleChange(e.currentTarget.value)}
							/>
							<Show when={field().state.meta.errors}>
								<p class="text-red-500 text-sm mt-1">
									{field().state.meta.errors}
								</p>
							</Show>
						</div>
					</div>
				)}
			/>
			<form.Field
				name="description"
				validators={{
					onChange: mediaSourceSchema.shape.description,
				}}
				children={(field) => (
					<div class="grid grid-cols-4 items-center gap-4">
						<Label for={field().name} class="text-right">
							Description
						</Label>
						<div class="col-span-3">
							<Input
								id={field().name}
								name={field().name}
								value={field().state.value}
								onBlur={field().handleBlur}
								onInput={(e) => field().handleChange(e.currentTarget.value)}
							/>
							<Show when={field().state.meta.errors}>
								<p class="text-red-500 text-sm mt-1">
									{field().state.meta.errors}
								</p>
							</Show>
						</div>
					</div>
				)}
			/>
			<form.Field
				name="type"
				validators={{
					onChange: mediaSourceSchema.shape.type,
				}}
				children={(field) => (
					<div class="grid grid-cols-4 items-center gap-4">
						<Label for={field().name} class="text-right">
							Type
						</Label>
						<div class="col-span-3">
							<Select
								value={field().state.value}
								onValueChange={(value) =>
									field().handleChange(value as mediaSourceTypeEnum)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="local">Local</SelectItem>
									<SelectItem value="sftp">SFTP</SelectItem>
									<SelectItem value="s3">S3</SelectItem>
								</SelectContent>
							</Select>
							<Show when={field().state.meta.errors}>
								<p class="text-red-500 text-sm mt-1">
									{field().state.meta.errors}
								</p>
							</Show>
						</div>
					</div>
				)}
			/>
			<form.Field
				name="connectionInfo.path"
				validators={{
					onChange: mediaSourceSchema.shape.connectionInfo.shape.path,
				}}
				children={(field) => (
					<div class="grid grid-cols-4 items-center gap-4">
						<Label for={field().name} class="text-right">
							Path
						</Label>
						<div class="col-span-3">
							<Input
								id={field().name}
								name={field().name}
								value={field().state.value}
								onBlur={field().handleBlur}
								onInput={(e) => field().handleChange(e.currentTarget.value)}
							/>
							<Show when={field().state.meta.errors}>
								<p class="text-red-500 text-sm mt-1">
									{field().state.meta.errors}
								</p>
							</Show>
						</div>
					</div>
				)}
			/>

			<div class="flex justify-end gap-2 mt-4">
				<Button type="button" variant="outline" onClick={props.onCancel}>
					Cancel
				</Button>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
					children={([canSubmit, isSubmitting]) => (
						<Button type="submit" disabled={!canSubmit}>
							{isSubmitting ? "..." : "Save"}
						</Button>
					)}
				/>
			</div>
		</form>
	);
}
