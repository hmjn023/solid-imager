import { SCALAR_DOCS_PATH } from "@solid-imager/core/http";
import { AboutScreen } from "@solid-imager/ui/screens/about";

export function AboutPage() {
	return <AboutScreen docsHref={SCALAR_DOCS_PATH} />;
}
