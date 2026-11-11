import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../select";

export function SourceSelect(props: {
	manager: UseManagerPageResult;
	onChange: (id: string | undefined) => void;
	placeholder?: string;
	value: string | undefined;
}) {
	const placeholder = () => props.placeholder ?? "All sources";
	return (
		<Select
			class="space-y-1.5"
			itemComponent={(selectProps) => (
				<SelectItem item={selectProps.item}>
					{selectProps.item.rawValue.name}
				</SelectItem>
			)}
			onChange={(value) => props.onChange(value?.id)}
			options={props.manager.sources()}
			optionTextValue="name"
			optionValue="id"
			placeholder={placeholder()}
			value={
				props.value
					? props.manager.sources().find((source) => source.id === props.value)
					: null
			}
		>
			<SelectLabel>Target source</SelectLabel>
			<SelectTrigger class="w-full bg-card">
				<SelectValue<unknown>>
					{(state) => {
						const selected = state.selectedOption();
						return selected &&
							typeof selected === "object" &&
							"name" in selected
							? (selected as { name: string }).name
							: placeholder();
					}}
				</SelectValue>
			</SelectTrigger>
			<SelectContent />
		</Select>
	);
}
