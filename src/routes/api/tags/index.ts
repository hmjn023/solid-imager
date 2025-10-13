import type { APIEvent } from "@solidjs/start/server";
import { createTag, getTags } from "~/infrastructure/api-clients/tags";

/**
 *
 * @returns すべてのタグ
 */
export async function GET() {
  const tags = await getTags();
  return tags;
}

/**
 * タグを作成します。
 *
 * @returns 作成されたタグ
 */
export async function POST({ request }: APIEvent) {
  const data = await request.json();
  const newTag = await createTag(data);
  return newTag;
}
