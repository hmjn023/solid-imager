import { detectPlatform } from "@tanstack/solid-hotkeys";
import {
	type Accessor,
	createContext,
	createSignal,
	onMount,
	type ParentComponent,
	useContext,
} from "solid-js";

import {
	DEFAULT_SHORTCUT_BINDINGS,
	getShortcutDefinition,
	type ShortcutBinding,
	type ShortcutBindings,
	type ShortcutId,
} from "./definitions";
import {
	findShortcutConflict,
	hasCustomShortcutBindings,
	parseShortcutBinding,
	parseStoredShortcutPreferences,
	SHORTCUT_PREFERENCES_STORAGE_KEY,
	type ShortcutBindingParseResult,
	type ShortcutConflict,
	type ShortcutPlatform,
	serializeShortcutPreferences,
} from "./preferences-storage";

export type ShortcutBindingUpdateResult =
	| {
			readonly status: "updated";
			readonly binding: ShortcutBinding;
	  }
	| {
			readonly status: "conflict";
			readonly conflict: ShortcutConflict;
	  }
	| {
			readonly status: "invalid";
			readonly messages: readonly string[];
	  }
	| {
			readonly status: "unavailable";
	  };

export interface ShortcutPreferences {
	readonly bindings: Accessor<ShortcutBindings>;
	readonly getBinding: (id: ShortcutId) => ShortcutBinding;
	readonly updateBinding: (
		id: ShortcutId,
		binding: ShortcutBinding,
	) => ShortcutBindingUpdateResult;
	readonly resetBinding: (id: ShortcutId) => ShortcutBindingUpdateResult;
	readonly resetAllBindings: () => void;
	readonly findConflict: (
		id: ShortcutId,
		binding: ShortcutBinding,
	) => ShortcutConflict | null;
	readonly hasCustomBindings: Accessor<boolean>;
	readonly recordingShortcutId: Accessor<ShortcutId | null>;
	readonly isRecording: Accessor<boolean>;
	readonly setRecordingShortcutId: (id: ShortcutId | null) => void;
	readonly isSuspended: Accessor<boolean>;
	readonly setSuspended: (suspended: boolean) => void;
}

const ShortcutPreferencesContext = createContext<
	ShortcutPreferences | undefined
>();

function unavailableUpdate(): ShortcutBindingUpdateResult {
	return { status: "unavailable" };
}

const DEFAULT_SHORTCUT_PREFERENCES: ShortcutPreferences = {
	bindings: () => DEFAULT_SHORTCUT_BINDINGS,
	getBinding: (id) => DEFAULT_SHORTCUT_BINDINGS[id],
	updateBinding: unavailableUpdate,
	resetBinding: unavailableUpdate,
	resetAllBindings: () => undefined,
	findConflict: (id, binding) =>
		findShortcutConflict(DEFAULT_SHORTCUT_BINDINGS, id, binding),
	hasCustomBindings: () => false,
	recordingShortcutId: () => null,
	isRecording: () => false,
	setRecordingShortcutId: () => undefined,
	isSuspended: () => false,
	setSuspended: () => undefined,
};

function getBrowserLocalStorage(): Storage | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

export const ShortcutPreferencesProvider: ParentComponent = (props) => {
	const [bindings, setBindings] = createSignal<ShortcutBindings>(
		DEFAULT_SHORTCUT_BINDINGS,
	);
	const [recordingShortcutId, setRecordingShortcutId] =
		createSignal<ShortcutId | null>(null);
	const [isSuspended, setSuspended] = createSignal(false);
	let storage: Storage | null = null;
	let platform: ShortcutPlatform = "linux";

	const persist = (nextBindings: ShortcutBindings): void => {
		if (storage === null) {
			return;
		}

		try {
			storage.setItem(
				SHORTCUT_PREFERENCES_STORAGE_KEY,
				serializeShortcutPreferences(nextBindings),
			);
		} catch {
			// Preferences remain available for the current session if storage is full
			// or unavailable in a privacy-restricted browser context.
		}
	};

	const commitBindings = (nextBindings: ShortcutBindings): void => {
		setBindings(nextBindings);
		persist(nextBindings);
	};

	const updateBinding = (
		id: ShortcutId,
		candidate: ShortcutBinding,
	): ShortcutBindingUpdateResult => {
		const parsed: ShortcutBindingParseResult = parseShortcutBinding(
			candidate,
			platform,
		);
		if (!parsed.valid) {
			return { status: "invalid", messages: parsed.messages };
		}

		const conflict = findShortcutConflict(
			bindings(),
			id,
			parsed.binding,
			platform,
		);
		if (conflict !== null) {
			return { status: "conflict", conflict };
		}

		const nextBindings: ShortcutBindings = {
			...bindings(),
			[id]: parsed.binding,
		};
		commitBindings(nextBindings);
		return { status: "updated", binding: parsed.binding };
	};

	const resetBinding = (id: ShortcutId): ShortcutBindingUpdateResult =>
		updateBinding(id, getShortcutDefinition(id).defaultBinding);

	const resetAllBindings = (): void => {
		commitBindings(DEFAULT_SHORTCUT_BINDINGS);
	};

	const contextValue: ShortcutPreferences = {
		bindings,
		getBinding: (id) => bindings()[id],
		updateBinding,
		resetBinding,
		resetAllBindings,
		findConflict: (id, binding) =>
			findShortcutConflict(bindings(), id, binding, platform),
		hasCustomBindings: () => hasCustomShortcutBindings(bindings(), platform),
		recordingShortcutId,
		isRecording: () => recordingShortcutId() !== null,
		setRecordingShortcutId,
		isSuspended,
		setSuspended,
	};

	onMount(() => {
		platform = detectPlatform();
		storage = getBrowserLocalStorage();
		if (storage === null) {
			return;
		}

		try {
			setBindings(
				parseStoredShortcutPreferences(
					storage.getItem(SHORTCUT_PREFERENCES_STORAGE_KEY),
					platform,
				),
			);
		} catch {
			setBindings(DEFAULT_SHORTCUT_BINDINGS);
		}
	});

	return (
		<ShortcutPreferencesContext.Provider value={contextValue}>
			{props.children}
		</ShortcutPreferencesContext.Provider>
	);
};

export function useOptionalShortcutPreferences():
	| ShortcutPreferences
	| undefined {
	return useContext(ShortcutPreferencesContext);
}

export function useShortcutPreferences(): ShortcutPreferences {
	return useOptionalShortcutPreferences() ?? DEFAULT_SHORTCUT_PREFERENCES;
}
