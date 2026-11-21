import { DesignConceptScreen } from "@solid-imager/ui/screens/design-lab";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/design-lab")({
	component: DesignLabRoute,
});

function DesignLabRoute() {
	return <DesignConceptScreen />;
}
