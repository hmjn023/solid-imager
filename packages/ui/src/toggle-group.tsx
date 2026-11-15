import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { VariantProps } from "class-variance-authority";
import type { JSX, ValidComponent } from "solid-js";
import {
	createContext,
	createMemo,
	createSignal,
	splitProps,
	useContext,
} from "solid-js";

import { Toggle, type ToggleProps, type toggleVariants } from "./toggle";
import { cn } from "./utils/cn";

type ToggleGroupOrientation = "horizontal" | "vertical";

type ToggleGroupSelectionProps =
	| {
			multiple?: false;
			value?: string | null;
			defaultValue?: string;
			onChange?: (value: string | null) => void;
	  }
	| {
			multiple: true;
			value?: string[];
			defaultValue?: string[];
			onChange?: (value: string[]) => void;
	  };

type ToggleGroupContextValue = VariantProps<typeof toggleVariants> & {
	disabled: boolean;
	orientation: ToggleGroupOrientation;
	isSelected: (value: string) => boolean;
	onItemToggle: (value: string, pressed: boolean) => void;
};

const ToggleGroupContext = createContext<ToggleGroupContextValue>({
	size: "default",
	variant: "default",
	disabled: false,
	orientation: "horizontal",
	isSelected: () => false,
	onItemToggle: () => {},
});

function normalizeSelection(
	value: string | string[] | null | undefined,
): string[] {
	if (Array.isArray(value)) {
		return value;
	}
	if (typeof value === "string") {
		return [value];
	}
	return [];
}

function emitSelectionChange(
	props: ToggleGroupSelectionProps,
	nextValues: string[],
) {
	if (props.multiple) {
		props.onChange?.(nextValues);
		return;
	}
	props.onChange?.(nextValues[0] ?? null);
}

type NavigationTarget = 1 | -1 | "first" | "last";

function resolveNavigationTarget(
	key: string,
	orientation: ToggleGroupOrientation,
	isRtl: boolean,
): NavigationTarget | null {
	if (key === "Home") {
		return "first";
	}
	if (key === "End") {
		return "last";
	}
	if (orientation === "horizontal") {
		if (key === "ArrowRight") {
			return isRtl ? -1 : 1;
		}
		if (key === "ArrowLeft") {
			return isRtl ? 1 : -1;
		}
		return null;
	}
	if (key === "ArrowDown") {
		return 1;
	}
	if (key === "ArrowUp") {
		return -1;
	}
	return null;
}

function focusAdjacentToggleItem(
	group: Element,
	currentItem: Element,
	direction: NavigationTarget,
) {
	const items = Array.from(
		group.querySelectorAll<HTMLElement>(
			"[data-toggle-group-item]:not([disabled]):not([data-disabled])",
		),
	).filter((item) => item.closest("[data-toggle-group]") === group);
	if (items.length === 0) {
		return false;
	}
	if (direction === "first") {
		items[0]?.focus();
		return true;
	}
	if (direction === "last") {
		items[items.length - 1]?.focus();
		return true;
	}
	const currentIndex = items.findIndex((item) => item === currentItem);
	const nextIndex =
		currentIndex === -1
			? direction === 1
				? 0
				: items.length - 1
			: (currentIndex + direction + items.length) % items.length;
	items[nextIndex]?.focus();
	return true;
}

function invokeKeyDownHandler<T extends HTMLElement>(
	handler: JSX.EventHandlerUnion<T, KeyboardEvent> | undefined,
	event: KeyboardEvent & { currentTarget: T; target: Element },
) {
	if (typeof handler === "function") {
		handler(event);
		return;
	}
	if (Array.isArray(handler)) {
		const [fn, data] = handler;
		fn(data, event);
	}
}

type ToggleGroupRootProps = ToggleGroupSelectionProps &
	VariantProps<typeof toggleVariants> &
	Omit<JSX.HTMLAttributes<HTMLDivElement>, "children" | "onChange"> & {
		class?: string | undefined;
		children?: JSX.Element;
		disabled?: boolean;
		orientation?: ToggleGroupOrientation;
		disallowEmptySelection?: boolean;
	};

// The registry root consumes Escape to clear selection. Let parent dialogs handle it.
const ToggleGroup = (props: ToggleGroupRootProps) => {
	const [local, others] = splitProps(props, [
		"class",
		"children",
		"size",
		"variant",
		"multiple",
		"value",
		"defaultValue",
		"onChange",
		"disabled",
		"orientation",
		"disallowEmptySelection",
	]);

	const [uncontrolledValues, setUncontrolledValues] = createSignal<string[]>(
		normalizeSelection(props.defaultValue),
	);
	const selectedValues = createMemo(() =>
		props.value !== undefined
			? normalizeSelection(props.value)
			: uncontrolledValues(),
	);
	const orientation = () => local.orientation ?? "horizontal";

	const handleItemToggle = (itemValue: string, pressed: boolean) => {
		if (local.disabled) {
			return;
		}
		const current = selectedValues();
		let nextValues: string[];
		if (local.multiple) {
			if (pressed) {
				nextValues = current.includes(itemValue)
					? current
					: [...current, itemValue];
			} else {
				if (
					local.disallowEmptySelection &&
					current.length <= 1 &&
					current.includes(itemValue)
				) {
					return;
				}
				nextValues = current.filter((v) => v !== itemValue);
			}
		} else if (pressed) {
			nextValues = [itemValue];
		} else if (local.disallowEmptySelection) {
			return;
		} else {
			nextValues = [];
		}

		if (props.value === undefined) {
			setUncontrolledValues(nextValues);
		}
		emitSelectionChange(props, nextValues);
	};

	return (
		<div
			// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- WAI-ARIA button toggle group avoids native <fieldset> box-layout quirks.
			role="group"
			data-toggle-group=""
			aria-disabled={local.disabled ? "true" : undefined}
			data-orientation={orientation()}
			class={cn(
				"flex items-center justify-center gap-1",
				orientation() === "vertical" && "flex-col",
				local.class,
			)}
			{...others}
		>
			<ToggleGroupContext.Provider
				value={{
					get size() {
						return local.size;
					},
					get variant() {
						return local.variant;
					},
					get disabled() {
						return Boolean(local.disabled);
					},
					get orientation() {
						return orientation();
					},
					isSelected: (value) => selectedValues().includes(value),
					onItemToggle: handleItemToggle,
				}}
			>
				{local.children}
			</ToggleGroupContext.Provider>
		</div>
	);
};

type ToggleGroupItemProps<T extends ValidComponent = "button"> = Omit<
	ToggleProps<T>,
	"pressed" | "defaultPressed" | "onChange"
> & {
	value: string;
	onKeyDown?: JSX.EventHandlerUnion<HTMLElement, KeyboardEvent>;
};

const ToggleGroupItem = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, ToggleGroupItemProps<T>>,
) => {
	const [local, others] = splitProps(props as ToggleGroupItemProps, [
		"class",
		"size",
		"variant",
		"value",
		"disabled",
		"onKeyDown",
	]);
	const context = useContext(ToggleGroupContext);

	const handleKeyDown: JSX.EventHandler<HTMLElement, KeyboardEvent> = (
		event,
	) => {
		invokeKeyDownHandler(local.onKeyDown, event);
		if (event.defaultPrevented || context.disabled || local.disabled) {
			return;
		}
		const group = event.currentTarget.closest("[data-toggle-group]");
		if (!group) {
			return;
		}
		// Only intercept navigation keys so Escape and Tab continue to reach enclosing dialogs/popovers.
		const isRtl = getComputedStyle(group).direction === "rtl";
		const target = resolveNavigationTarget(
			event.key,
			context.orientation,
			isRtl,
		);
		if (target === null) {
			return;
		}
		if (focusAdjacentToggleItem(group, event.currentTarget, target)) {
			event.preventDefault();
		}
	};

	return (
		<Toggle
			data-toggle-group-item=""
			data-orientation={context.orientation}
			pressed={context.isSelected(local.value)}
			disabled={context.disabled || local.disabled}
			onChange={(pressed) => context.onItemToggle(local.value, pressed)}
			onKeyDown={handleKeyDown}
			size={context.size || local.size}
			variant={context.variant || local.variant}
			class={cn(
				"hover:bg-muted hover:text-muted-foreground data-[pressed]:bg-accent data-[pressed]:text-accent-foreground",
				local.class,
			)}
			{...others}
		/>
	);
};

export { ToggleGroup, ToggleGroupItem };
