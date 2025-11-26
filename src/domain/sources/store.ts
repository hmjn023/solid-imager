import { createStore } from "solid-js/store";
import { isServer } from "solid-js/web";

export type SourcesState = {
  // Map of mediaSourceId to scrollY position
  scrollPositions: Record<string, number>;
};

const defaultState: SourcesState = {
  scrollPositions: {},
};

const STORAGE_KEY = "solid-imager-scroll-positions";

// Initialize state from sessionStorage if available
const getInitialState = (): SourcesState => {
  if (isServer) {
    return defaultState;
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultState;
  } catch {
    return defaultState;
  }
};

export const [sourcesState, setSourcesState] = createStore<SourcesState>(
  getInitialState()
);

// Helper to persist to sessionStorage
const persistToStorage = () => {
  if (isServer) {
    return;
  }
  const data = JSON.stringify(sourcesState);
  sessionStorage.setItem(STORAGE_KEY, data);
};

export const getScrollPosition = (mediaSourceId: string) => {
  const position = sourcesState.scrollPositions[mediaSourceId] || 0;
  return position;
};

export const setScrollPosition = (mediaSourceId: string, scrollY: number) => {
  setSourcesState("scrollPositions", mediaSourceId, scrollY);
  // Persist immediately after updating
  persistToStorage();
};
