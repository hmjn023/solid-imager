import { type Accessor, createEffect, createSignal } from "solid-js";

export type MediaCollectionSelectionState<Id extends string = string> = {
	readonly selectedIds: ReadonlySet<Id>;
	readonly activeId: Id | null;
	readonly anchorId: Id | null;
	readonly focusedId: Id | null;
};

/**
 * A semantic selection intent. UI adapters can translate pointer or keyboard
 * modifiers into one of these values without coupling this controller to DOM
 * event types.
 */
export type MediaCollectionSelectionMode =
	| "replace"
	| "toggle"
	| "range"
	| "additive-range";

export type HiddenSelectionPolicy = "remove" | "preserve";

export type MediaCollectionSelectionAction<Id extends string = string> =
	| {
			type: "select";
			id: Id;
			mode?: MediaCollectionSelectionMode;
	  }
	| { type: "select-all" }
	| { type: "clear" }
	| { type: "focus"; id: Id | null }
	| { type: "reconcile" };

export type MediaCollectionSelectionReducerOptions = {
	hiddenSelectionPolicy?: HiddenSelectionPolicy;
};

export type MediaCollectionSelectionOptions<Id extends string = string> =
	MediaCollectionSelectionReducerOptions & {
		initialState?: MediaCollectionSelectionState<Id>;
	};

export type MediaCollectionSelectionController<Id extends string = string> = {
	readonly state: Accessor<MediaCollectionSelectionState<Id>>;
	readonly selectedIds: Accessor<ReadonlySet<Id>>;
	readonly activeId: Accessor<Id | null>;
	readonly anchorId: Accessor<Id | null>;
	readonly focusedId: Accessor<Id | null>;
	readonly isSelected: (id: Id) => boolean;
	readonly select: (id: Id, mode?: MediaCollectionSelectionMode) => void;
	readonly selectAll: () => void;
	readonly clear: () => void;
	readonly setFocusedId: (id: Id | null) => void;
	readonly reconcile: () => void;
	readonly dispatch: (action: MediaCollectionSelectionAction<Id>) => void;
};

export function createEmptyMediaCollectionSelectionState<
	Id extends string = string,
>(): MediaCollectionSelectionState<Id> {
	return {
		selectedIds: new Set<Id>(),
		activeId: null,
		anchorId: null,
		focusedId: null,
	};
}

function getOrderedUniqueIds<Id extends string>(
	visibleIds: readonly Id[],
): readonly Id[] {
	return [...new Set(visibleIds)];
}

function areSetsEqual<Id extends string>(
	left: ReadonlySet<Id>,
	right: ReadonlySet<Id>,
): boolean {
	if (left.size !== right.size) {
		return false;
	}
	for (const id of left) {
		if (!right.has(id)) {
			return false;
		}
	}
	return true;
}

function createNextState<Id extends string>(
	previous: MediaCollectionSelectionState<Id>,
	next: MediaCollectionSelectionState<Id>,
): MediaCollectionSelectionState<Id> {
	if (
		previous.activeId === next.activeId &&
		previous.anchorId === next.anchorId &&
		previous.focusedId === next.focusedId &&
		areSetsEqual(previous.selectedIds, next.selectedIds)
	) {
		return previous;
	}
	return next;
}

function getFirstSelectedId<Id extends string>(
	visibleIds: readonly Id[],
	selectedIds: ReadonlySet<Id>,
): Id | null {
	return visibleIds.find((id) => selectedIds.has(id)) ?? null;
}

function getVisibleSelection<Id extends string>(
	selectedIds: ReadonlySet<Id>,
	visibleIds: readonly Id[],
): Set<Id> {
	const visibleIdSet = new Set(visibleIds);
	return new Set([...selectedIds].filter((id) => visibleIdSet.has(id)));
}

/**
 * Removes selection state that no longer belongs to the current ordered
 * collection. Reordering alone retains all four selection cursors.
 */
export function reconcileMediaCollectionSelection<Id extends string>(
	state: MediaCollectionSelectionState<Id>,
	visibleIds: readonly Id[],
	options: MediaCollectionSelectionReducerOptions = {},
): MediaCollectionSelectionState<Id> {
	if (options.hiddenSelectionPolicy === "preserve") {
		return state;
	}

	const orderedIds = getOrderedUniqueIds(visibleIds);
	const visibleIdSet = new Set(orderedIds);
	const selectedIds = getVisibleSelection(state.selectedIds, orderedIds);
	const activeId =
		state.activeId !== null && selectedIds.has(state.activeId)
			? state.activeId
			: getFirstSelectedId(orderedIds, selectedIds);
	const focusedId =
		state.focusedId !== null && visibleIdSet.has(state.focusedId)
			? state.focusedId
			: activeId;
	const anchorId =
		state.anchorId !== null && visibleIdSet.has(state.anchorId)
			? state.anchorId
			: activeId;

	return createNextState(state, {
		selectedIds,
		activeId,
		anchorId,
		focusedId,
	});
}

function selectRange<Id extends string>(
	state: MediaCollectionSelectionState<Id>,
	id: Id,
	visibleIds: readonly Id[],
	additive: boolean,
	hiddenSelectionPolicy: HiddenSelectionPolicy,
): MediaCollectionSelectionState<Id> {
	const anchorId =
		state.anchorId !== null && visibleIds.includes(state.anchorId)
			? state.anchorId
			: id;
	const anchorIndex = visibleIds.indexOf(anchorId);
	const targetIndex = visibleIds.indexOf(id);
	const rangeStart = Math.min(anchorIndex, targetIndex);
	const rangeEnd = Math.max(anchorIndex, targetIndex);
	const rangeIds = visibleIds.slice(rangeStart, rangeEnd + 1);
	const previousSelectedIds =
		hiddenSelectionPolicy === "preserve"
			? state.selectedIds
			: getVisibleSelection(state.selectedIds, visibleIds);
	const selectedIds = new Set(
		additive ? [...previousSelectedIds, ...rangeIds] : rangeIds,
	);

	return createNextState(state, {
		selectedIds,
		activeId: id,
		anchorId,
		focusedId: id,
	});
}

/** Pure selection reducer. The ordered visible IDs define range order. */
export function reduceMediaCollectionSelection<Id extends string>(
	state: MediaCollectionSelectionState<Id>,
	action: MediaCollectionSelectionAction<Id>,
	visibleIds: readonly Id[],
	options: MediaCollectionSelectionReducerOptions = {},
): MediaCollectionSelectionState<Id> {
	const orderedIds = getOrderedUniqueIds(visibleIds);
	const visibleIdSet = new Set(orderedIds);
	const hiddenSelectionPolicy = options.hiddenSelectionPolicy ?? "remove";

	switch (action.type) {
		case "clear":
			return createNextState(state, createEmptyMediaCollectionSelectionState());
		case "reconcile":
			return reconcileMediaCollectionSelection(state, orderedIds, options);
		case "focus": {
			const focusedId =
				action.id !== null && visibleIdSet.has(action.id) ? action.id : null;
			return createNextState(state, { ...state, focusedId });
		}
		case "select-all": {
			if (orderedIds.length === 0) {
				return createNextState(
					state,
					createEmptyMediaCollectionSelectionState(),
				);
			}
			const selectedIds = new Set(
				hiddenSelectionPolicy === "preserve"
					? [...state.selectedIds, ...orderedIds]
					: orderedIds,
			);
			const activeId =
				state.activeId !== null && visibleIdSet.has(state.activeId)
					? state.activeId
					: orderedIds[0];
			const focusedId =
				state.focusedId !== null && visibleIdSet.has(state.focusedId)
					? state.focusedId
					: activeId;
			const anchorId =
				state.anchorId !== null && visibleIdSet.has(state.anchorId)
					? state.anchorId
					: activeId;
			return createNextState(state, {
				selectedIds,
				activeId,
				anchorId,
				focusedId,
			});
		}
		case "select": {
			if (!visibleIdSet.has(action.id)) {
				return reconcileMediaCollectionSelection(state, orderedIds, options);
			}

			const mode = action.mode ?? "replace";
			if (mode === "range" || mode === "additive-range") {
				return selectRange(
					state,
					action.id,
					orderedIds,
					mode === "additive-range",
					hiddenSelectionPolicy,
				);
			}

			if (mode === "toggle") {
				const previousSelectedIds =
					hiddenSelectionPolicy === "preserve"
						? state.selectedIds
						: getVisibleSelection(state.selectedIds, orderedIds);
				const wasSelected = previousSelectedIds.has(action.id);
				const selectedIds = new Set(
					wasSelected
						? [...previousSelectedIds].filter((id) => id !== action.id)
						: [...previousSelectedIds, action.id],
				);
				const retainedActiveId =
					state.activeId !== action.id &&
					state.activeId !== null &&
					selectedIds.has(state.activeId)
						? state.activeId
						: null;
				const activeId = wasSelected
					? (retainedActiveId ?? getFirstSelectedId(orderedIds, selectedIds))
					: action.id;
				return createNextState(state, {
					selectedIds,
					activeId,
					anchorId: action.id,
					focusedId: action.id,
				});
			}

			return createNextState(state, {
				selectedIds: new Set([action.id]),
				activeId: action.id,
				anchorId: action.id,
				focusedId: action.id,
			});
		}
	}
}

/**
 * Solid controller around the pure reducer. It contains no browser globals,
 * so it is safe to create during SSR.
 */
export function useMediaCollectionSelection<Id extends string>(
	visibleIds: Accessor<readonly Id[]>,
	options: MediaCollectionSelectionOptions<Id> = {},
): MediaCollectionSelectionController<Id> {
	const reducerOptions: MediaCollectionSelectionReducerOptions = {
		hiddenSelectionPolicy: options.hiddenSelectionPolicy ?? "remove",
	};
	const initialState = reconcileMediaCollectionSelection(
		options.initialState ?? createEmptyMediaCollectionSelectionState<Id>(),
		visibleIds(),
		reducerOptions,
	);
	const [state, setState] = createSignal(initialState);

	const dispatch = (action: MediaCollectionSelectionAction<Id>): void => {
		setState((current) =>
			reduceMediaCollectionSelection(
				current,
				action,
				visibleIds(),
				reducerOptions,
			),
		);
	};

	createEffect(() => {
		const currentVisibleIds = visibleIds();
		setState((current) =>
			reduceMediaCollectionSelection(
				current,
				{ type: "reconcile" },
				currentVisibleIds,
				reducerOptions,
			),
		);
	});

	return {
		state,
		selectedIds: () => state().selectedIds,
		activeId: () => state().activeId,
		anchorId: () => state().anchorId,
		focusedId: () => state().focusedId,
		isSelected: (id) => state().selectedIds.has(id),
		select: (id, mode = "replace") => dispatch({ type: "select", id, mode }),
		selectAll: () => dispatch({ type: "select-all" }),
		clear: () => dispatch({ type: "clear" }),
		setFocusedId: (id) => dispatch({ type: "focus", id }),
		reconcile: () => dispatch({ type: "reconcile" }),
		dispatch,
	};
}
