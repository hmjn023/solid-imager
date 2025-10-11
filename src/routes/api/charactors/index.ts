import type { APIEvent } from "@solidjs/start/server";
import { createCharacter, getCharacters } from "~/lib/api/characters";

/**
 *
 * @returns すべてのキャラクター
 */

export async function GET() {
  const characters = await getCharacters();
  return characters;
}

/**
 * キャラクターを作成します。
 *
 * @returns 作成されたキャラクター
 */
export async function POST({ request }: APIEvent) {
  const data = await request.json();
  const newCharacter = await createCharacter(data);
  return newCharacter;
}
