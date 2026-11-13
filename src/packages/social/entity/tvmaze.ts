import { commonParseFactory } from "../utils.ts";

const tvmazeUrlPattern = /^(?:https?:\/\/)?(?:www\.)?tvmaze\.com\/shows\/(\d+)(?:\/[^\/]+)?\/?$/;

export function build(id: string): string {
  return `https://www.tvmaze.com/shows/${id}`;
}

export const parse = commonParseFactory([tvmazeUrlPattern]);
