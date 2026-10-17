import {
	createStartHandler,
	defaultStreamHandler,
} from "@tanstack/solid-start/server";
import { withRequestAbortHandling } from "./infrastructure/http/request-abort-handler";

export default {
	fetch: withRequestAbortHandling(createStartHandler(defaultStreamHandler)),
};
