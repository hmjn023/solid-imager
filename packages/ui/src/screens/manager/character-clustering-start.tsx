import {
	startCharacterClusteringSchema,
	type StartCharacterClustering,
} from "@solid-imager/core/domain/characters/schemas";
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
				保存済みCCIPのあるsolo画像を全ソースから解析します。キャラクター登録は変更しません。
			</p>
			<fieldset
				class="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4"
				disabled={mutation.isPending}
			>
				<legend class="sr-only">クラスタリングの実行条件</legend>
				<TextField value={neighbors()} onChange={setNeighbors}>
					<TextFieldLabel>近傍数</TextFieldLabel>
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
					<TextFieldLabel>最小クラスタ枚数</TextFieldLabel>
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
					<TextFieldLabel>密度の最小サンプル数</TextFieldLabel>
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
								? "細かいグループ（leaf）"
								: "安定したグループ（EOM）"}
						</SelectItem>
					)}
				>
					<SelectLabel>グループの選び方</SelectLabel>
					<SelectTrigger>
						<SelectValue<string>>
							{(state) =>
								state.selectedOption() === "leaf"
									? "細かいグループ（leaf）"
									: "安定したグループ（EOM）"
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
					{mutation.isPending ? "開始しています…" : "クラスタリングを開始"}
				</Button>
				<Show when={mutation.isSuccess}>
					<p aria-live="polite" class="text-sm">
						解析ジョブを登録しました。完了後に「結果を再読み込み」で確認できます。
					</p>
					<Button type="button" variant="outline" onClick={props.openJobs}>
						Jobsで確認
					</Button>
				</Show>
			</div>
			<Show when={mutation.isError}>
				<p role="alert" class="text-sm text-destructive">
					解析を開始できませんでした。{mutation.error?.message}
				</p>
			</Show>
		</form>
	);
}
