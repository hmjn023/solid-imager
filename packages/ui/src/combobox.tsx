// Adapted from the Solid UI v2 combobox registry recipe.
import Check from "@lucide/solid/icons/check";
import { t } from "@solid-imager/i18n";
import type { ComponentProps, JSX } from "@solidjs/web";
import * as Sdk from "@ui-sdk/solid/combobox";
import {
	createContext,
	createMemo,
	createSignal,
	For,
	Show,
	onCleanup,
	omit,
	useContext,
} from "solid-js";
import { Button } from "./button";
import { InputGroup } from "./input-group";
import { cn } from "./utils/cn";
import { createVirtualizer } from "./utils/virtualizer";

type OptionProperty<T> = keyof T | ((option: T) => string);
type Choice<T> = {
	key: string;
	textValue: string;
	rawValue: T;
	index?: number;
};
type CommonProps<T> = {
	children?: JSX.Element;
	inline?: boolean;
	class?: string;
	disabled?: boolean;
	name?: string;
	placeholder?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	query?: string;
	onInputChange?: (query: string) => void;
	noResetInputOnBlur?: boolean;
	triggerMode?: "focus" | "input";
	options: T[];
	optionValue?: OptionProperty<T>;
	optionLabel?: OptionProperty<T>;
	optionTextValue?: OptionProperty<T>;
	defaultFilter?: (option: T, query: string) => boolean;
	itemComponent?: (props: { item: Choice<T> }) => JSX.Element;
	disallowEmptySelection?: boolean;
};
type ComboboxProps<T> = CommonProps<T> &
	(
		| {
				multiple?: false;
				value?: T | null;
				onChange?: (value: T | null) => void;
		  }
		| { multiple: true; value?: T[]; onChange?: (value: T[]) => void }
	);
type ComboboxContextValue = {
	placeholder?: string;
	triggerMode?: CommonProps<string>["triggerMode"];
	controller: Sdk.ComboboxController<string, boolean>;
	renderItem: (key: string, index?: number) => JSX.Element;
	visibleKeys: () => string[];
	registerScroll: (scroll: (index: number) => void) => void;
};
const ComboboxContext = createContext<ComboboxContextValue>();

function readOption<T>(option: T, property?: OptionProperty<T>): string {
	if (typeof property === "function") return property(option);
	return String(property === undefined ? option : option[property]);
}

function useComboboxContext() {
	const context = useContext(ComboboxContext);
	return {
		isOpen: context.controller.isOpen,
		close: context.controller.close,
		setInputValue: context.controller.setQuery,
	};
}

function Combobox<T>(props: ComboboxProps<T>) {
	const controller = Sdk.createComboboxController<string, boolean>();
	let scrollToItem: ((index: number) => void) | undefined;
	const choices = createMemo(
		() =>
			new Map(
				props.options.map((option) => [
					readOption(option, props.optionValue),
					{
						key: readOption(option, props.optionValue),
						textValue: readOption(
							option,
							props.optionTextValue ?? props.optionLabel,
						),
						rawValue: option,
					},
				]),
			),
	);
	const items = createMemo(() =>
		Array.from(choices().values())
			.filter(
				(choice) =>
					props.defaultFilter?.(choice.rawValue, props.query ?? "") ?? true,
			)
			.map((choice) => ({ value: choice.key, label: choice.textValue })),
	);
	const selectedId = (option: T) => readOption(option, props.optionValue);
	const context: ComboboxContextValue = {
		get placeholder() {
			return props.placeholder;
		},
		get triggerMode() {
			return props.triggerMode;
		},
		controller,
		visibleKeys: () => items().map((item) => item.value),
		renderItem: (key, index) => {
			return (
				<Show keyed when={choices().get(key)}>
					{(choice) => {
						const option = { ...choice, index };
						return (
							<>
								{props.itemComponent ? (
									props.itemComponent({ item: option })
								) : (
									<ComboboxItem item={option}>{choice.textValue}</ComboboxItem>
								)}
							</>
						);
					}}
				</Show>
			);
		},
		registerScroll: (scroll) => {
			scrollToItem = scroll;
		},
	};

	return (
		<ComboboxContext value={context}>
			<div class={props.class}>
				<Sdk.Combobox<string, boolean>
					controller={controller}
					disabled={props.disabled}
					multiple={props.multiple}
					name={props.name}
					open={props.open}
					onOpenChange={(open, details) => {
						if (
							props.inline &&
							!open &&
							(details.reason === "focus-out" ||
								details.reason === "outside-press")
						) {
							details.cancel();
							return;
						}
						props.onOpenChange?.(open);
					}}
					items={props.inline ? undefined : items()}
					filter={props.defaultFilter ? false : "contains"}
					query={props.query}
					onQueryChange={(query, details) => {
						if (
							props.noResetInputOnBlur &&
							details.reason !== "input-change" &&
							details.reason !== "imperative"
						) {
							details.cancel();
							return;
						}
						if (details.reason !== "imperative") props.onInputChange?.(query);
					}}
					value={
						props.multiple
							? props.value?.map(selectedId)
							: props.value === undefined
								? undefined
								: props.value === null
									? null
									: selectedId(props.value)
					}
					itemToLabel={(id) =>
						choices().get(id)?.textValue ??
						(!props.multiple && props.value != null
							? readOption(props.value, props.optionLabel)
							: id)
					}
					onValueChange={(value) => {
						if (props.multiple) {
							const selected = Array.isArray(value) ? value : [];
							const options = new Map(
								props.value?.map((item) => [selectedId(item), item]),
							);
							props.onChange?.(
								selected.flatMap((id) => {
									const item = choices().get(id)?.rawValue ?? options.get(id);
									return item === undefined ? [] : [item];
								}),
							);
						} else if (typeof value === "string") {
							props.onChange?.(choices().get(value)?.rawValue ?? null);
						} else if (!props.disallowEmptySelection) {
							props.onChange?.(null);
						}
					}}
					onHighlight={(_, details) => scrollToItem?.(details.index)}
				>
					{props.children}
				</Sdk.Combobox>
			</div>
		</ComboboxContext>
	);
}

function ComboboxControl(props: JSX.IntrinsicElements["div"]) {
	return (
		<InputGroup
			{...omit(props, "class")}
			class={cn(
				"flex h-10 items-center rounded-md border border-input px-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
				props.class,
			)}
		/>
	);
}

function ComboboxInput(props: ComponentProps<typeof Sdk.ComboboxInput>) {
	const context = useContext(ComboboxContext);
	return (
		<Sdk.ComboboxInput
			{...omit(props, "class", "onFocus", "placeholder")}
			data-ui="input-group-control"
			class={cn(
				"flex size-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
				props.class,
			)}
			placeholder={props.placeholder ?? context.placeholder}
			onFocus={(event) => {
				if (typeof props.onFocus === "function") props.onFocus(event);
				if (!event.defaultPrevented && context.triggerMode === "focus") {
					context.controller.setOpen(true);
				}
			}}
		/>
	);
}

function ComboboxLabel(props: ComponentProps<typeof Sdk.ComboboxLabel>) {
	return (
		<Sdk.ComboboxLabel
			{...omit(props, "class")}
			class={cn(
				"font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				props.class,
			)}
		/>
	);
}

function ComboboxItem<T>(
	props: Omit<ComponentProps<typeof Sdk.ComboboxItem>, "value" | "index"> & {
		item: Choice<T>;
	},
) {
	return (
		<Sdk.ComboboxItem
			{...omit(props, "item", "class")}
			value={props.item.key}
			index={props.item.index}
			label={props.item.textValue}
			class={cn(
				"relative flex min-h-11 cursor-default select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-muted data-[selected]:font-medium data-[highlighted]:text-foreground data-[disabled]:opacity-50",
				props.class,
			)}
		/>
	);
}

function ComboboxItemLabel(props: JSX.IntrinsicElements["span"]) {
	// Render the caller's rich label instead of the SDK's plain-text match segments.
	return (
		<Sdk.ComboboxItemText
			{...omit(props, "children", "style")}
			style={props.style || undefined}
			children={() => props.children}
		/>
	);
}

function ComboboxItemIndicator(
	props: ComponentProps<typeof Sdk.ComboboxItemIndicator>,
) {
	return (
		<Sdk.ComboboxItemIndicator {...props}>
			{props.children ?? <Check aria-hidden="true" class="size-4" />}
		</Sdk.ComboboxItemIndicator>
	);
}

function ComboboxTrigger(props: ComponentProps<typeof Sdk.ComboboxTrigger>) {
	return (
		<Sdk.ComboboxTrigger
			aria-label={t("controls.toggleOptions")}
			render={(partProps) => (
				<Button {...partProps} size="icon" variant="ghost" />
			)}
			{...omit(props, "class")}
			class={cn(
				"flex min-h-11 min-w-11 items-center justify-center opacity-50",
				props.class,
			)}
		>
			{props.children ?? (
				<svg
					aria-hidden="true"
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="m8 9 4-4 4 4m0 6-4 4-4-4" />
				</svg>
			)}
		</Sdk.ComboboxTrigger>
	);
}

const ComboboxSection = Sdk.ComboboxGroup;

type ContentProps = Omit<
	ComponentProps<typeof Sdk.ComboboxContent>,
	"children" | "container"
> & { portalMount?: HTMLElement };

function itemKeys(items: Sdk.ListData<unknown>): string[] {
	return items.flatMap((item) => {
		if (typeof item === "string") return [item];
		if ("value" in item && typeof item.value === "string") return [item.value];
		return [];
	});
}

function ComboboxList(props: ComponentProps<typeof Sdk.ComboboxList>) {
	return (
		<Sdk.ComboboxList
			{...omit(props, "class")}
			class={cn("m-0 overflow-y-auto overscroll-contain p-1", props.class)}
		/>
	);
}

const popupListClass = "min-h-0 flex-1";

function ComboboxListItems(props: { items: Sdk.ListData<unknown> }) {
	const context = useContext(ComboboxContext);
	return (
		<For each={itemKeys(props.items)}>
			{(key) => <>{context.renderItem(key)}</>}
		</For>
	);
}

function VirtualComboboxList(props: { items: Sdk.ListData<unknown> }) {
	const context = useContext(ComboboxContext);
	const keys = createMemo(() => itemKeys(props.items));
	const [scrollElement, setScrollElement] = createSignal<HTMLDivElement | null>(
		null,
	);
	const virtualizer = createVirtualizer({
		get count() {
			return keys().length;
		},
		getScrollElement: scrollElement,
		estimateSize: () => 44,
		overscan: 5,
	});
	context.registerScroll((index) => virtualizer.scrollToIndex(index));
	onCleanup(() => context.registerScroll(() => {}));

	return (
		<ComboboxList class={popupListClass} ref={setScrollElement}>
			<div
				class="relative w-full virtualized-combobox-list"
				style={{ "--combobox-list-height": `${virtualizer.getTotalSize()}px` }}
			>
				<For each={virtualizer.getVirtualItems()}>
					{(row) => (
						<div
							class="absolute top-0 left-0 w-full virtualized-combobox-row"
							style={{
								"--combobox-row-height": `${row.size}px`,
								"--combobox-row-offset": `${row.start}px`,
							}}
						>
							{context.renderItem(keys()[row.index] ?? "", row.index)}
						</div>
					)}
				</For>
			</div>
		</ComboboxList>
	);
}

function ComboboxPopup(props: ContentProps & { virtual?: boolean }) {
	return (
		<Sdk.ComboboxContent
			{...omit(props, "class", "portalMount", "virtual")}
			class={cn(
				"motion-safe:fade-in-80 relative z-50 flex max-h-[min(24rem,var(--available-height,calc(100dvh-2rem)))] min-w-32 max-w-viewport-gutter flex-col overflow-hidden overscroll-contain rounded-md border bg-popover text-popover-foreground shadow-md motion-safe:animate-in",
				props.class,
			)}
			container={props.portalMount}
		>
			{(state) => (
				<Show
					when={props.virtual}
					fallback={
						<ComboboxList class={popupListClass}>
							<ComboboxListItems items={state.items} />
						</ComboboxList>
					}
				>
					<VirtualComboboxList items={state.items} />
				</Show>
			)}
		</Sdk.ComboboxContent>
	);
}

function ComboboxContent(props: ContentProps) {
	return <ComboboxPopup {...props} />;
}

function VirtualComboboxContent(props: ContentProps) {
	return <ComboboxPopup {...props} virtual />;
}

function ComboboxInlineListbox() {
	const context = useContext(ComboboxContext);
	return (
		<ComboboxList
			class="max-h-60 rounded-md border bg-popover text-popover-foreground"
			onMouseDown={(event) => {
				if (event.button === 0) event.preventDefault();
			}}
		>
			<For each={context.visibleKeys()}>
				{(key) => <>{context.renderItem(key)}</>}
			</For>
		</ComboboxList>
	);
}

export {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInlineListbox,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxItemLabel,
	ComboboxLabel,
	ComboboxSection,
	ComboboxTrigger,
	useComboboxContext,
	VirtualComboboxContent,
};
