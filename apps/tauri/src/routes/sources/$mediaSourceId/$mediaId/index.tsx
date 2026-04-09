import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@solid-imager/ui/tabs";
import { Textarea } from "@solid-imager/ui/textarea";
import { toast } from "@solid-imager/ui/toast";
import { createFileRoute, Link, useParams } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Show } from "solid-js";
import { getMockMedia, getMockSource } from "../../../../mocks/demo-data";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	component: MediaDetailRoute,
});

function MediaDetailRoute() {
	const params = useParams({ from: "/sources/$mediaSourceId/$mediaId/" });
	const [notes, setNotes] = createSignal(
		"Check whether the final Tauri API shape should preserve this metadata card layout.",
	);
	const [isFavorite, setIsFavorite] = createSignal(false);
	const media = createMemo(() => getMockMedia(params().mediaId));
	const source = createMemo(() => getMockSource(params().mediaSourceId));

	return (
		<section class="grid gap-6">
			<div class="flex items-start justify-between gap-4">
				<div class="grid gap-3">
					<Link
						class="text-sky-700 text-sm hover:underline"
						params={{ mediaSourceId: params().mediaSourceId }}
						to="/sources/$mediaSourceId"
					>
						Back to source
					</Link>
					<h1 class="font-semibold text-4xl tracking-tight">
						{media()?.title ?? "Unknown Media"}
					</h1>
					<p class="text-muted-foreground">
						{source()?.name ?? "Unknown source"} · {media()?.resolution ?? "--"}
					</p>
				</div>
				<Show when={media()}>
					{(item) => <Badge variant="outline">{item().status}</Badge>}
				</Show>
			</div>

			<div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
				<div class="grid gap-4">
					<div
						class="min-h-[340px] rounded-3xl border"
						style={{
							background:
								media()?.accent ?? "linear-gradient(135deg, #475569, #94a3b8)",
						}}
					/>
					<div class="flex flex-wrap gap-2">
						<Button
							onClick={() => {
								setIsFavorite((value) => !value);
								toast.success(
									isFavorite() ? "Removed favorite flag" : "Marked as favorite",
								);
							}}
							variant={isFavorite() ? "secondary" : "outline"}
						>
							{isFavorite() ? "Favorited" : "Favorite"}
						</Button>
						<Button onClick={() => toast.success("Mock approval saved")}>
							Approve Metadata
						</Button>
					</div>
				</div>

				<Tabs class="grid gap-4" defaultValue="metadata">
					<TabsList class="grid h-auto grid-cols-3 gap-2 p-1">
						<TabsTrigger value="metadata">Metadata</TabsTrigger>
						<TabsTrigger value="prompt">Prompt</TabsTrigger>
						<TabsTrigger value="notes">Notes</TabsTrigger>
					</TabsList>

					<TabsContent value="metadata">
						<Card>
							<CardHeader>
								<CardTitle>Metadata</CardTitle>
							</CardHeader>
							<CardContent class="grid gap-3 text-sm">
								<div class="flex items-center justify-between rounded-lg border px-4 py-3">
									<span class="text-muted-foreground">Author</span>
									<span>{media()?.author}</span>
								</div>
								<div class="flex items-center justify-between rounded-lg border px-4 py-3">
									<span class="text-muted-foreground">Updated</span>
									<span>{media()?.updatedAt}</span>
								</div>
								<div class="grid gap-2 rounded-lg border px-4 py-3">
									<span class="text-muted-foreground">Tags</span>
									<div class="flex flex-wrap gap-2">
										<For each={media()?.tags ?? []}>
											{(tag) => <Badge variant="secondary">{tag}</Badge>}
										</For>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="prompt">
						<Card>
							<CardHeader>
								<CardTitle>Prompt Preview</CardTitle>
							</CardHeader>
							<CardContent>
								<p class="rounded-xl border bg-muted/40 p-4 text-sm">
									{media()?.prompt}
								</p>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="notes">
						<Card>
							<CardHeader>
								<CardTitle>Notes</CardTitle>
							</CardHeader>
							<CardContent class="grid gap-4">
								<Textarea
									onInput={(event) => setNotes(event.currentTarget.value)}
									value={notes()}
								/>
								<Button
									onClick={() => toast.success("Mock note saved")}
									variant="outline"
								>
									Save Note
								</Button>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</section>
	);
}
