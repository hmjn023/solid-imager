import { implement } from "@orpc/server";
import { mediaGroupsContract } from "@solid-imager/core/contract";
import { MediaGroupRepository } from "~/infrastructure/db/repositories";
const os = implement(mediaGroupsContract);
export const mediaGroupsRouter = os.router({
	list: os.list.handler(({ input }) => MediaGroupRepository.list(input)),
	create: os.create.handler(({ input }) => MediaGroupRepository.create(input)),
	setMember: os.setMember.handler(({ input }) =>
		MediaGroupRepository.setMember(input),
	),
});
