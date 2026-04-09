import { orpc } from "./orpc-client";

export const fetchAllAuthors = async () => await orpc.authors.list();
