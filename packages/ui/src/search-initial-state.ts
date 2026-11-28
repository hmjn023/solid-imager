import type {
	SafeSearchSnapshot,
	SearchState,
} from "@solid-imager/core/search";
import { createComponent } from "@solidjs/web";
import {
	createContext,
	createSignal,
	type ParentProps,
	untrack,
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
} | null>(null);

/** Keeps the server's inputs local to this view until browser history has been restored. */
export function InitialSearchProvider(
	props: ParentProps<{
		initial?: InitialSearchState;
	}>,
) {
	const [initial, setInitial] = createSignal(untrack(() => props.initial));
	return createComponent(InitialSearchContext, {
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
