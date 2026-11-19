import type { SafeMediaSource } from "@solid-imager/core/sources";
import { t } from "@solid-imager/i18n";
import { type Accessor, createResource, createSignal, Show } from "solid-js";
import { Alert, AlertDescription } from "./alert";
import { RetryButton } from "./async-state";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "./select";

type DestinationSource = { id: string; name: string };

export function useMediaDestinationSources(
	open: Accessor<boolean>,
	listSources: () => Promise<SafeMediaSource[]>,
) {
	const [sources, { refetch }] = createResource(
		() => (open() ? true : undefined),
		listSources,
		{ initialValue: [] },
	);
	return {
		sources: () =>
			sources.error
				? []
				: sources().flatMap(({ id, name }) => (id ? [{ id, name }] : [])),
		loading: () => sources.loading,
		failed: () => Boolean(sources.error),
		retry: async () => {
			await refetch();
		},
	};
}

export function MediaDestinationField(props: {
	options: DestinationSource[];
	value?: DestinationSource;
	onChange: (id: string) => void;
	disabled?: boolean;
	loading: boolean;
	failed: boolean;
	onRetry: () => Promise<void>;
	id?: string;
}) {
	const [field, setField] = createSignal<HTMLDivElement>();
	return (
		<div class="grid gap-2" ref={setField}>
			<Select<DestinationSource>
				class="grid gap-2"
				disabled={
					props.disabled ||
					props.loading ||
					props.failed ||
					!props.options.length
				}
				disallowEmptySelection
				itemComponent={(itemProps) => (
					<SelectItem item={itemProps.item}>
						{itemProps.item.rawValue.name}
					</SelectItem>
				)}
				onChange={(source) => props.onChange(source?.id ?? "")}
				options={props.options}
				optionTextValue="name"
				optionValue="id"
				placeholder={t("actions.selectSource")}
				required
				value={props.value ?? null}
			>
				<SelectLabel>{t("moveCopyMediaDialog.destinationSource")}</SelectLabel>
				<SelectTrigger id={props.id}>
					<SelectValue<DestinationSource>>
						{(state) =>
							state.selectedOption()?.name ?? t("actions.selectSource")
						}
					</SelectValue>
				</SelectTrigger>
				<SelectContent portalMount={field()} />
			</Select>
			<Show when={props.loading}>
				<output class="text-muted-foreground text-sm">
					{t("moveCopyMediaDialog.loadingSources")}
				</output>
			</Show>
			<Show when={props.failed && !props.loading}>
				<Alert variant="destructive">
					<AlertDescription>
						{t("feedback.sourcesLoadFailed")}
						<RetryButton class="mt-2" onRetry={props.onRetry} />
					</AlertDescription>
				</Alert>
			</Show>
			<Show when={!props.loading && !props.failed && !props.options.length}>
				<p class="text-muted-foreground text-sm">
					{t("moveCopyMediaDialog.noDestinationSources")}
				</p>
			</Show>
		</div>
	);
}
