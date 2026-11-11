import Search from "lucide-solid/icons/search";
import { createEffect, createSignal, type JSX, Show } from "solid-js";
import { Button } from "../button";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
	useComboboxContext,
	VirtualComboboxContent,
} from "../combobox";
import { Label } from "../label";
import { ShortcutKbd } from "../shortcuts/shortcut-kbd";

type ComposerOption = {
	value: string;
	label: string;
	description?: string;
};

type ComposerInputProps = {
	draft: string;
	id: string;
	label: string;
	placeholder: string;
	describedBy?: string;
	inputRef?: (element: HTMLInputElement) => void;
	onDraftChange: (value: string) => void;
	onCaretChange?: (position: number) => void;
	onFocus: () => void;
	onKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent>;
};

function ComposerInput(props: ComposerInputProps) {
	const context = useComboboxContext();
	createEffect(() => context.setInputValue(props.draft));
	const updateCaret = (event: Event & { currentTarget: HTMLInputElement }) => {
		const element = event.currentTarget;
		props.onCaretChange?.(element.selectionStart ?? element.value.length);
	};

	return (
		<ComboboxInput
			aria-label={props.label}
			aria-describedby={props.describedBy}
			class="h-7 min-h-7 min-w-0 flex-1 basis-32 border-0 bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
			enterkeyhint="search"
			id={props.id}
			on:keydown={(event: KeyboardEvent) => {
				// Kobalte also handles delegated Enter; keep composition keys native.
				if (
					event.isComposing ||
					// oxlint-disable-next-line typescript/no-deprecated -- Safari can report IME confirmation only through keyCode 229.
					(event.key === "Enter" && event.keyCode === 229)
				) {
					event.stopPropagation();
				}
			}}
			onFocus={props.onFocus}
			onInput={(event: InputEvent & { currentTarget: HTMLInputElement }) => {
				updateCaret(event);
				props.onDraftChange(event.currentTarget.value);
			}}
			onClick={updateCaret}
			onKeyUp={updateCaret}
			onKeyDown={props.onKeyDown}
			placeholder={props.placeholder}
			ref={props.inputRef}
		/>
	);
}

/** Editable query field shared by the library and external tag search. */
export function SearchComposerField<T extends ComposerOption>(props: {
	id: string;
	label: string;
	draft: string;
	placeholder: string;
	options: T[];
	optionValue?: (item: T) => string;
	onSelect: (item: T) => { draft: string; caret?: number };
	onDraftChange: (value: string) => void;
	onSubmit: () => void;
	onCaretChange?: (position: number) => void;
	onEmptyBackspace?: () => void;
	inputRef?: (element: HTMLInputElement) => void;
	children?: JSX.Element;
	hint?: string;
	status?: string;
	submitLabel?: string;
	virtualized?: boolean;
}) {
	let input: HTMLInputElement | undefined;
	const [open, setOpen] = createSignal(false);
	const menuVisible = () => open() && props.options.length > 0;
	const submit = () => {
		setOpen(false);
		props.onSubmit();
	};
	const handleKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (
		event,
	) => {
		if (event.isComposing) return;
		if (event.key === "Backspace" && !props.draft && props.onEmptyBackspace) {
			event.preventDefault();
			props.onEmptyBackspace();
		} else if (
			event.key === "Enter" &&
			!event.currentTarget.getAttribute("aria-activedescendant")
		) {
			event.preventDefault();
			submit();
		} else if (event.key === "Escape" && !menuVisible()) {
			props.onDraftChange("");
		}
	};
	const handleSelect = (option: T | null) => {
		if (!option) return;
		const { draft, caret } = props.onSelect(option);
		setOpen(false);
		props.onDraftChange(draft);
		if (caret !== undefined) {
			props.onCaretChange?.(caret);
			// The combobox focuses the input and moves its caret after selection.
			queueMicrotask(() => {
				if (input?.value === draft) input.setSelectionRange(caret, caret);
			});
		}
	};
	return (
		<form
			autocomplete="off"
			class="min-w-popover-input flex-1"
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<div class="flex min-w-0 items-start gap-2">
				<div class="relative min-w-0 flex-1">
					<Label class="sr-only" for={props.id}>
						{props.label}
					</Label>
					<Search
						aria-hidden="true"
						class="pointer-events-none absolute top-3 left-3 z-10 text-muted-foreground"
						size={16}
					/>
					<Combobox<T>
						allowDuplicateSelectionEvents
						closeOnSelection
						noResetInputOnBlur
						defaultFilter={() => true}
						disallowEmptySelection={false}
						itemComponent={(item) => (
							<ComboboxItem item={item.item} class="gap-3">
								<ComboboxItemLabel class="min-w-0 truncate">
									{item.item.rawValue.label}
								</ComboboxItemLabel>
								<Show when={item.item.rawValue.description}>
									{(description) => (
										<span class="shrink-0 text-muted-foreground text-xs">
											{description()}
										</span>
									)}
								</Show>
							</ComboboxItem>
						)}
						onChange={handleSelect}
						onOpenChange={setOpen}
						open={menuVisible()}
						optionLabel="label"
						optionTextValue="label"
						optionValue={(item) => props.optionValue?.(item) ?? item.value}
						options={props.options}
						removeOnBackspace={false}
						triggerMode="input"
						value={null}
					>
						<ComboboxControl<T>
							aria-label={props.label}
							class="flex h-auto min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card py-1 pr-8 pl-9 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 sm:min-h-9"
						>
							{props.children}
							<ComposerInput
								draft={props.draft}
								id={props.id}
								label={props.label}
								describedBy={props.hint ? props.id + "-hint" : undefined}
								inputRef={(el) => {
									input = el;
									props.inputRef?.(el);
								}}
								onCaretChange={props.onCaretChange}
								onDraftChange={(value) => {
									props.onDraftChange(value);
									setOpen(true);
								}}
								onFocus={() => setOpen(true)}
								onKeyDown={handleKeyDown}
								placeholder={props.placeholder}
							/>
						</ComboboxControl>
						<Show
							when={props.virtualized}
							fallback={
								<ComboboxContent class="workspace-theme w-popover-large" />
							}
						>
							<VirtualComboboxContent class="workspace-theme w-popover-large p-1 shadow-xl" />
						</Show>
					</Combobox>
					<ShortcutKbd
						class="pointer-events-none absolute top-2 right-2 min-h-5 border-border px-1.5 py-0.5 text-label-xs leading-none text-muted-foreground shadow-none"
						shortcutId="focusSearch"
					/>
				</div>
				<Show when={props.submitLabel}>
					{(label) => <Button type="submit">{label()}</Button>}
				</Show>
			</div>
			<Show when={props.hint}>
				{(hint) => (
					<p class="mt-1 text-muted-foreground text-xs" id={props.id + "-hint"}>
						{hint()}
					</p>
				)}
			</Show>
			<Show when={props.status}>
				{(status) => (
					<output class="text-muted-foreground text-xs">{status()}</output>
				)}
			</Show>
		</form>
	);
}
