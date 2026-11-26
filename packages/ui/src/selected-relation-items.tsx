import { t } from "@solid-imager/i18n";
import X from "@lucide/solid/icons/x";
import { For, Show } from "solid-js";
import { Button } from "./button";
import { cn } from "./utils/cn";

type NamedItem = { id: string; name: string };

function SelectedRelationChip(props: {
	name: string;
	staged?: boolean;
	disabled?: boolean;
	onRemove: () => void;
}) {
	return (
		<li class="min-w-0 max-w-full">
			<Button
				type="button"
				size="sm"
				variant="outline"
				class={cn(
					"h-auto min-h-11 max-w-full gap-2 whitespace-normal px-2.5 py-1.5 text-start pointer-fine:min-h-8",
					!props.staged &&
						"border-primary/20 bg-accent text-accent-foreground hover:bg-muted",
				)}
				aria-label={t("relationsEditor.removeSelection", { name: props.name })}
				disabled={props.disabled}
				onClick={props.onRemove}
			>
				<span class="min-w-0 wrap-anywhere">
					{props.staged
						? t("relationsEditor.valueNew", { value0: props.name })
						: props.name}
				</span>
				<X aria-hidden="true" size={14} />
			</Button>
		</li>
	);
}

export function SelectedRelationItems(props: {
	items: NamedItem[];
	staged?: { names: string[]; onRemove: (name: string) => void };
	disabled?: boolean;
	onRemove: (id: string) => void;
}) {
	let heading: HTMLHeadingElement | undefined;

	return (
		<section class="min-w-0 self-start rounded-lg border border-border bg-muted/50 p-3">
			<h3
				class="font-semibold text-sm"
				ref={(element) => {
					heading = element;
				}}
				tabindex={-1}
			>
				{t("relationsEditor.selectedItems")}
			</h3>
			<Show
				when={props.items.length || props.staged?.names.length}
				fallback={
					<p class="mt-1 text-sm text-muted-foreground">
						{t("relationsEditor.noneSelected")}
					</p>
				}
			>
				<ul class="mt-2 flex flex-wrap gap-2">
					<For each={props.items}>
						{(item) => (
							<SelectedRelationChip
								name={item.name}
								disabled={props.disabled}
								onRemove={() => {
									heading?.focus({ preventScroll: true });
									props.onRemove(item.id);
								}}
							/>
						)}
					</For>
					<For each={props.staged?.names}>
						{(name) => (
							<SelectedRelationChip
								staged
								name={name}
								disabled={props.disabled}
								onRemove={() => {
									heading?.focus({ preventScroll: true });
									props.staged?.onRemove(name);
								}}
							/>
						)}
					</For>
				</ul>
			</Show>
		</section>
	);
}
