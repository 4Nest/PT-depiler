import { commonParseFactory } from "../utils";

const bgmUrlPattern = /^(?:https?:\/\/)?(?:bgm\.tv|bangumi\.tv|chii\.in)\/subject\/(\d+)\/?/;

export function build(id: string): string {
  return `https://bgm.tv/subject/${id}`;
}

export const parse = commonParseFactory([bgmUrlPattern]);
