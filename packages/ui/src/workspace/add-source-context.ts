import { createContext } from "solid-js";

export const AddSourceContext = createContext<(() => void) | null>(null);
