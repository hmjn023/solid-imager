export type TwitterPostIdentity = {
	postId: string;
	remoteId: string;
	username: string;
	displayName: string;
	observedAt: string;
};

function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** UserByScreenName's exact profile result, excluding users embedded in timelines. */
export function collectTwitterProfile(payload: unknown) {
	if (!record(payload) || !record(payload.data) || !record(payload.data.user))
		return null;
	const user = payload.data.user.result;
	if (!record(user) || user.__typename !== "User") return null;
	const core = record(user.core) ? user.core : null;
	const legacy = record(user.legacy) ? user.legacy : null;
	const remoteId = user.rest_id;
	const username = core?.screen_name ?? legacy?.screen_name;
	const displayName = core?.name ?? legacy?.name;
	if (
		typeof remoteId !== "string" ||
		!/^[0-9]+$/.test(remoteId) ||
		typeof username !== "string" ||
		!/^[A-Za-z0-9_]{1,15}$/.test(username) ||
		typeof displayName !== "string" ||
		!displayName.trim()
	)
		return null;
	return { remoteId, username, displayName };
}

/** Read only the author of this exact post, never an arbitrary nested/quoted user. */
export function collectTwitterIdentities(
	payload: unknown,
	observedAt: string,
): TwitterPostIdentity[] {
	const identities = new Map<string, TwitterPostIdentity>();
	const queue: { value: unknown; depth: number }[] = [
		{ value: payload, depth: 0 },
	];
	let visited = 0;
	while (queue.length && visited++ < 50000) {
		const entry = queue.pop();
		if (!entry || entry.depth > 40) continue;
		if (Array.isArray(entry.value)) {
			for (const value of entry.value)
				queue.push({ value, depth: entry.depth + 1 });
			continue;
		}
		const value = entry.value;
		if (!record(value)) continue;
		const postId = value.rest_id;
		const userResults = record(value.core) && value.core.user_results;
		const user = record(userResults) && userResults.result;
		if (typeof postId === "string" && /^[0-9]+$/.test(postId) && record(user)) {
			const remoteId = user.rest_id;
			const legacy = record(user.legacy) ? user.legacy : null;
			const core = record(user.core) ? user.core : null;
			const username = core?.screen_name ?? legacy?.screen_name;
			const displayName = core?.name ?? legacy?.name;
			const legacyUserId = record(value.legacy)
				? value.legacy.user_id_str
				: undefined;
			if (
				typeof remoteId === "string" &&
				/^[0-9]+$/.test(remoteId) &&
				typeof username === "string" &&
				/^[A-Za-z0-9_]{1,15}$/.test(username) &&
				typeof displayName === "string" &&
				displayName.trim() &&
				(!legacyUserId || legacyUserId === remoteId)
			) {
				identities.set(postId, {
					postId,
					remoteId,
					username,
					displayName,
					observedAt,
				});
			}
		}
		for (const nested of Object.values(value))
			if (nested !== null && typeof nested === "object") {
				queue.push({ value: nested, depth: entry.depth + 1 });
			}
	}
	return [...identities.values()];
}
