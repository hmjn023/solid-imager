import { t } from "@solid-imager/i18n";
import {
	startCharacterClusteringSchema,
	type StartCharacterClustering,
} from "@solid-imager/core/characters";
import { createMutation } from "@tanstack/solid-query";
import { createSignal, Show } from "solid-js";
import { Button } from "../../button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../select";
import { TextField, TextFieldInput, TextFieldLabel } from "../../text-field";

export function CharacterClusteringStart(props: {
	start: (input: StartCharacterClustering) => Promise<{ jobId: string }>;
	openJobs: () => void;
}) {
	const [neighbors, setNeighbors] = createSignal("64");
	const [minClusterSize, setMinClusterSize] = createSignal("5");
	const [minSamples, setMinSamples] = createSignal("3");
	const [selectionMethod, setSelectionMethod] = createSignal<"eom" | "leaf">(
		"leaf",
	);
	const mutation = createMutation(() => ({
		mutationFn: async () => {
			const parsed = startCharacterClusteringSchema.safeParse({
				neighbors: Number(neighbors()),
				minClusterSize: Number(minClusterSize()),
				minSamples: Number(minSamples()),
				selectionMethod: selectionMethod(),
			});
			if (!parsed.success) throw new Error(parsed.error.issues[0].message);
			return props.start(parsed.data);
		},
	}));
	return (
		<form
			class="space-y-3 border-b pb-4"
			onSubmit={(event) => {
				event.preventDefault();
				if (!mutation.isPending) mutation.mutate();
			}}
		>
			<p class="text-sm text-muted-foreground">
				{t(
					"characterClusteringStart.analyzeSoloImagesWithSavedCCIPVectorsAcrossAll",
				)}
			</p>
			<fieldset
				class="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4"
				disabled={mutation.isPending}
			>
				<legend class="sr-only">
					{t("characterClusteringStart.clusteringSettings")}
				</legend>
				<TextField value={neighbors()} onChange={setNeighbors}>
					<TextFieldLabel>
						{t("characterClusteringStart.neighborCount")}
					</TextFieldLabel>
					<TextFieldInput
						name="neighbors"
						type="number"
						required
						min={2}
						max={256}
						step={1}
					/>
				</TextField>
				<TextField value={minClusterSize()} onChange={setMinClusterSize}>
					<TextFieldLabel>
						{t("characterClusteringStart.minimumClusterSize")}
					</TextFieldLabel>
					<TextFieldInput
						name="minClusterSize"
						type="number"
						required
						min={2}
						max={10000}
						step={1}
					/>
				</TextField>
				<TextField value={minSamples()} onChange={setMinSamples}>
					<TextFieldLabel>
						{t("characterClusteringStart.minimumSamplesForDensity")}
					</TextFieldLabel>
					<TextFieldInput
						name="minSamples"
						type="number"
						required
						min={1}
						max={Number(neighbors()) || 256}
						step={1}
					/>
				</TextField>
				<Select<"eom" | "leaf">
					options={["leaf", "eom"]}
					value={selectionMethod()}
					onChange={(value) => {
						if (value) setSelectionMethod(value);
					}}
					disabled={mutation.isPending}
					itemComponent={(item) => (
						<SelectItem item={item.item}>
							{item.item.rawValue === "leaf"
								? t("characterClusteringStart.fineGroupsLeaf")
								: t("characterClusteringStart.stableGroupsEOM")}
						</SelectItem>
					)}
				>
					<SelectLabel>
						{t("characterClusteringStart.groupSelectionMethod")}
					</SelectLabel>
					<SelectTrigger>
						<SelectValue<string>>
							{(state) =>
								state.selectedOption() === "leaf"
									? t("characterClusteringStart.fineGroupsLeaf")
									: t("characterClusteringStart.stableGroupsEOM")
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
			</fieldset>
			<div class="flex flex-wrap items-center gap-3">
				<Button
					class="min-h-11 sm:min-h-9"
					type="submit"
					disabled={mutation.isPending}
				>
					{mutation.isPending
						? t("status.starting")
						: t("characterClusteringStart.startClustering")}
				</Button>
				<Show when={mutation.isSuccess}>
					<p aria-live="polite" class="text-sm">
						{t(
							"characterClusteringStart.analysisJobQueuedReloadResultsAfterItCompletes",
						)}
					</p>
					<Button type="button" variant="outline" onClick={props.openJobs}>
						{t("actions.viewJobs")}
					</Button>
				</Show>
			</div>
			<Show when={mutation.isError}>
				<p role="alert" class="text-sm text-destructive">
					{t("characterClusteringStart.couldNotStartAnalysisValue", {
						value0: String(mutation.error?.message),
					})}
				</p>
			</Show>
		</form>
	);
}
