import { Meta, MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { Suspense } from "solid-js";
import Nav from "./components/nav";
import "./app.css";

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const FIVE_MINUTES = 5;
const FIVE_MINUTES_IN_MS = FIVE_MINUTES * MINUTES_TO_MS;

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			staleTime: FIVE_MINUTES_IN_MS,
			refetchOnWindowFocus: false,
		},
	},
});

export default function App() {
	return (
		<MetaProvider>
			<Title>Solid Imager</Title>
			<Meta charset="utf-8" />
			<QueryClientProvider client={queryClient}>
				<Router
					root={(props) => (
						<>
							<Nav />
							<Suspense>{props.children}</Suspense>
						</>
					)}
				>
					<FileRoutes />
				</Router>
			</QueryClientProvider>
		</MetaProvider>
	);
}
