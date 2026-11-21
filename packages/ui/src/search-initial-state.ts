import type {
	SafeSearchSnapshot,
	SearchState,
} from "@solid-imager/core/search";
import {
	createComponent,
	createContext,
	createSignal,
	type ParentProps,
	useContext,
} from "solid-js";
import { searchState } from "./stores/search-store";

export type InitialSearchState = {
	state: SearchState;
	snapshot?: SafeSearchSnapshot;
};

const InitialSearchContext = createContext<{
	initial: () => InitialSearchState | undefined;
	finish: () => void;
}>();

/** Keeps the server's inputs local to this view until browser history has been restored. */
export function InitialSearchProvider(
	props: ParentProps<{
		initial?: InitialSearchState;
	}>,
) {
	const [initial, setInitial] = createSignal(props.initial);
	return createComponent(InitialSearchContext.Provider, {
		value: { initial, finish: () => setInitial(undefined) },
		get children() {
			return props.children;
		},
	});
}

export function useInitialSearch() {
	return useContext(InitialSearchContext);
}

export function useRenderedSearchState() {
	const initial = useInitialSearch();
	return () => initial?.initial()?.state ?? searchState;
}
