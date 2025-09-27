import type { APIEvent } from "@solidjs/start/server";
import { createTag, getTags } from "~/lib/api/tags";

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
  const { name, description, attribute, color } = await request.json();
  const newTag = await createTag(name, description, attribute, color);
  return newTag;
}
