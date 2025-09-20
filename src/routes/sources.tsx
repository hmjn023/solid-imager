import { useQuery } from "@tanstack/solid-query";
import { For, Match, Switch } from "solid-js";
import SourceCard from "~/components/sourceCard";
import type { mediaSourceInfo } from "~/lib/types";

export default function Sources() {
	const mediaSources = useQuery(() => ({
		queryKey: ["mediaSources"],
		queryFn: async () => {
			const response = await fetch("http://localhost:3000/api/sources/");
			return (await response.json()) as mediaSourceInfo[];
		},
	}));

	const handleEdit = (source: mediaSourceInfo) => {
		console.log("Editing:", source);
	};

	const handleDelete = (sourceName: string) => {
		console.log("Deleting:", sourceName);
	};

	return (
		<main class="text-center mx-auto text-gray-700 p-4">
			<h1 class="mb-4 text-3xl font-bold">Media Sources</h1>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				<Switch>
					<Match when={mediaSources.isPending}>Loading...</Match>
					<Match when={mediaSources.isError}>
						Error: {mediaSources.error?.message}
					</Match>
					<Match when={mediaSources.isSuccess}>
						<For each={mediaSources.data}>{
							(source) => (
								<SourceCard
									mediaSource={source}
									onEdit={handleEdit}
									onDelete={handleDelete}
								/>
							)
						}
						</For>
					</Match>
				</Switch>
			</div>
		</main>
	);
}