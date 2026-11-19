import { t } from "@solid-imager/i18n";
import { createMemo } from "solid-js";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../select";

type SourceOption = { id: string; name: string };
const ALL_SOURCES_ID = "__all__";

export function SourceSelect(props: {
	sources: { id?: string; name: string }[];
	onChange: (id: string | undefined) => void;
	allowAll?: boolean;
	value: string | undefined;
}) {
	const options = createMemo(() => {
		const available = props.sources.filter((source): source is SourceOption =>
			Boolean(source.id),
		);
		return props.allowAll
			? [{ id: ALL_SOURCES_ID, name: t("labels.allSources") }, ...available]
			: available;
	});
	return (
		<Select<SourceOption>
			class="space-y-1.5"
			disallowEmptySelection
			itemComponent={(selectProps) => (
				<SelectItem item={selectProps.item}>
					{selectProps.item.rawValue.name}
				</SelectItem>
			)}
			onChange={(option) => {
				if (!option) return;
				const id = option.id === ALL_SOURCES_ID ? undefined : option.id;
				if (id !== props.value) props.onChange(id);
			}}
			options={options()}
			optionTextValue="name"
			optionValue="id"
			placeholder={t("actions.selectSource")}
			value={
				options().find(
					(option) => option.id === (props.value ?? ALL_SOURCES_ID),
				) ?? null
			}
		>
			<SelectLabel>{t("labels.targetSource")}</SelectLabel>
			<SelectTrigger class="w-full bg-card">
				<SelectValue<SourceOption>>
					{(state) => state.selectedOption()?.name ?? t("actions.selectSource")}
				</SelectValue>
			</SelectTrigger>
			<SelectContent />
		</Select>
	);
}
