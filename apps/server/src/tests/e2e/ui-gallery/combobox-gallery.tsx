import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
	VirtualComboboxContent,
} from "@solid-imager/ui/combobox";
import { createDebouncedSignal } from "@solid-imager/ui/utils/debounce";
import { createMemo, createSignal, For, Show } from "solid-js";

const OPTIONS = Array.from({ length: 100 }, (_, index) => ({
	id: `option-${index}`,
	label: `Candidate ${String(index).padStart(2, "0")}`,
}));

export function ComboboxGallery() {
	return (
		<main class="space-y-8 p-4">
			<For each={[false, true]}>
				{(virtual) => {
					const [selected, setSelected] = createSignal<
						(typeof OPTIONS)[number] | null
					>(null);
					const [filter, setFilter] = createDebouncedSignal("", 150);
					const options = createMemo(() =>
						OPTIONS.filter((option) =>
							option.label.toLowerCase().includes(filter().toLowerCase()),
						),
					);
					return (
						<section class="space-y-2">
							<h1>{virtual ? "Virtual candidates" : "Regular candidates"}</h1>
							<Combobox
								options={options()}
								optionValue="id"
								optionTextValue="label"
								optionLabel="label"
								value={selected()}
								onChange={setSelected}
								onInputChange={setFilter}
								triggerMode="focus"
								itemComponent={(props) => (
									<ComboboxItem item={props.item}>
										<ComboboxItemLabel>
											{props.item.textValue}
										</ComboboxItemLabel>
									</ComboboxItem>
								)}
							>
								<ComboboxControl>
									<ComboboxInput
										aria-label={
											virtual ? "Virtual candidates" : "Regular candidates"
										}
									/>
								</ComboboxControl>
								<Show when={virtual} fallback={<ComboboxContent />}>
									<VirtualComboboxContent class="max-h-[300px]" />
								</Show>
							</Combobox>
							<output
								aria-label={virtual ? "Virtual selection" : "Regular selection"}
							>
								{selected()?.label ?? "None"}
							</output>
						</section>
					);
				}}
			</For>
			<button type="button">Outside control</button>
		</main>
	);
}
