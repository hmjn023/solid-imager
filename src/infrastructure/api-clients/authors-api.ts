import { orpc } from "./orpc-client";

export const fetchAllAuthors = async () => {
  const result = await orpc.authors.list();
  return result;
};
