export const collectionQueryKeys = {
	tags: () => ["collections", "tags"] as const,
	sources: () => ["collections", "sources"] as const,
	projects: () => ["collections", "projects"] as const,
	characters: () => ["collections", "characters"] as const,
	ips: () => ["collections", "ips"] as const,
	authors: () => ["collections", "authors"] as const,
};
