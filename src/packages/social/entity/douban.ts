import { commonParseFactory } from "../utils.ts";

const doubanUrlPattern = /^(?:https?:\/\/)?(?:movie\.|www\.)?douban\.com\/subject\/(\d+)\/?/;

export function build(id: string): string {
  return `https://movie.douban.com/subject/${id}/`;
}

export const parse = commonParseFactory([doubanUrlPattern]);
