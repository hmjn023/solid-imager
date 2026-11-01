import { SCALAR_DOCS_PATH } from "@solid-imager/core/domain/contract/http-paths";
import { AboutScreen } from "@solid-imager/ui/screens/about-screen";

export function AboutPage() {
	return <AboutScreen docsHref={SCALAR_DOCS_PATH} />;
}
