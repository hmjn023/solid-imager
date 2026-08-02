import { DesignConceptScreen } from "@solid-imager/ui/screens/design-concept-screen";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/design-lab")({
	ssr: false,
	pendingComponent: () => null,
	component: DesignLabRoute,
});

function DesignLabRoute() {
	return <DesignConceptScreen />;
}
