import { createStore } from "solid-js/store";

export type SourcesState = {
  // Map of mediaSourceId to scrollY position
  scrollPositions: Record<string, number>;
};

const defaultState: SourcesState = {
  scrollPositions: {},
};

export const [sourcesState, setSourcesState] = createStore<SourcesState>({
  ...defaultState,
});

export const getScrollPosition = (mediaSourceId: string) =>
  sourcesState.scrollPositions[mediaSourceId] || 0;

export const setScrollPosition = (mediaSourceId: string, scrollY: number) => {
  setSourcesState("scrollPositions", mediaSourceId, scrollY);
};
