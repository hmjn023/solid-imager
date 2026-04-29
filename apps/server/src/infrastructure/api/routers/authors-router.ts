import { os } from "@orpc/server";
import { AuthorService } from "~/application/services/author-service";

export const authorsRouter = os.router({
	list: os.handler(async () =>
		[...(await AuthorService.list())].sort((left, right) =>
			right.name.localeCompare(left.name),
		),
	),
});
