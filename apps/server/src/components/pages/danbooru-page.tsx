import { DanbooruScreen } from "@solid-imager/ui/screens/danbooru";
import {
	Outlet,
	useLocation,
	useNavigate,
	useRouter,
} from "@tanstack/solid-router";
import { client } from "~/infrastructure/api-clients/orpc-client";

export function DanbooruPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const router = useRouter();
	let openedFromCollection = false;
	const selectedPostId = () => {
		const match = location().pathname.match(/^\/danbooru\/(\d+)\/?$/);
		const id = match ? Number(match[1]) : undefined;
		return id && Number.isSafeInteger(id) ? id : undefined;
	};
	return (
		<>
			<DanbooruScreen
				search={(input) => client.danbooru.search(input)}
				getPost={(id) => client.danbooru.getPost({ id })}
				suggestTags={(query) => client.danbooru.suggestTags({ query })}
				enqueueImport={(item) => client.imports.bulkAdd({ items: [item] })}
				selectedPostId={selectedPostId()}
				postHref={(id) => router.history.createHref(`/danbooru/${id}`)}
				onOpenPost={(id, replace) => {
					if (!selectedPostId()) openedFromCollection = true;
					void navigate({
						to: "/danbooru/$postId",
						params: { postId: String(id) },
						replace,
					});
				}}
				onClosePost={() => {
					if (openedFromCollection) {
						openedFromCollection = false;
						router.history.back();
					} else void navigate({ to: "/danbooru", replace: true });
				}}
			/>
			<Outlet />
		</>
	);
}
