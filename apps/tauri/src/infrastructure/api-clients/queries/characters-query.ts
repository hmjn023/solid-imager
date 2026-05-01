import { buildCharactersQueryOptions } from "@solid-imager/ui/query-options/characters-query";
import { fetchAllCharacters } from "../characters-api";

export const allCharactersQueryOptions = () => buildCharactersQueryOptions(fetchAllCharacters);
