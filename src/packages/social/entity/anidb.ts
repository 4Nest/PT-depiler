import { commonParseFactory } from "../utils";

const anidbUrlPattern = /(?:https?:\/\/)?(?:www\.)?anidb\.net\/(?:a|anime\/)(\d+)/;

export function build(id: string): string {
  return `https://anidb.net/anime/${id}`;
}

export const parse = commonParseFactory([anidbUrlPattern]);
