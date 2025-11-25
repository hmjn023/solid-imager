import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { isServer } from "solid-js/web";

export type SourcesState = {
  // Map of mediaSourceId to scrollY position
  scrollPositions: Record<string, number>;
};

const defaultState: SourcesState = {
  scrollPositions: {},
};

// Initialize state from sessionStorage if available
const getInitialState = (): SourcesState => {
  if (isServer) {
    return defaultState;
  }
  try {
    const stored = sessionStorage.getItem("solid-imager-scroll-positions");
    return stored ? JSON.parse(stored) : defaultState;
  } catch {
    return defaultState;
  }
};

export const [sourcesState, setSourcesState] = createStore<SourcesState>(
  getInitialState()
);

// Persist state to sessionStorage whenever it changes
createEffect(() => {
  if (isServer) {
    return;
  }
  sessionStorage.setItem(
    "solid-imager-scroll-positions",
    JSON.stringify(sourcesState)
  );
});

export const getScrollPosition = (mediaSourceId: string) =>
  sourcesState.scrollPositions[mediaSourceId] || 0;

export const setScrollPosition = (mediaSourceId: string, scrollY: number) => {
  setSourcesState("scrollPositions", mediaSourceId, scrollY);
};
