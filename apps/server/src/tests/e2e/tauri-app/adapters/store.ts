const STORE_KEY_PREFIX = "solid-imager:e2e:store:";

type StoreState = Record<string, unknown>;

function storageKey(path: string): string {
	return `${STORE_KEY_PREFIX}${path}`;
}

function readState(path: string): StoreState {
	const value = localStorage.getItem(storageKey(path));
	if (!value) {
		return {};
	}
	try {
		const parsed: unknown = JSON.parse(value);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as StoreState)
			: {};
	} catch {
		return {};
	}
}

/** Isolated localStorage-backed replacement for @tauri-apps/plugin-store. */
export class Store {
	private constructor(
		private readonly path: string,
		private state: StoreState,
	) {}

	static async load(
		path: string,
		options?: { defaults?: StoreState },
	): Promise<Store> {
		const state = readState(path);
		if (Object.keys(state).length === 0 && options?.defaults) {
			Object.assign(state, options.defaults);
		}
		return new Store(path, state);
	}

	async get<T>(key: string): Promise<T | undefined> {
		return this.state[key] as T | undefined;
	}

	async set(key: string, value: unknown): Promise<void> {
		this.state[key] = value;
	}

	async save(): Promise<void> {
		localStorage.setItem(storageKey(this.path), JSON.stringify(this.state));
	}
}
