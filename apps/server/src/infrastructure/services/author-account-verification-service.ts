import {
	createAuthorAccountVerificationService,
	createAuthorAccountVerificationState,
} from "@solid-imager/application/services/author-account-verification-service";
import { AuthorService } from "./author-service";

// Keep pending previews across dev module reloads and API bundle instances in this process.
const runtime = globalThis as typeof globalThis & {
	solidImagerAuthorAccountVerifications?: ReturnType<
		typeof createAuthorAccountVerificationState
	>;
};
const state = (runtime.solidImagerAuthorAccountVerifications ??=
	createAuthorAccountVerificationState());
export const AuthorAccountVerificationService =
	createAuthorAccountVerificationService(AuthorService, state);
