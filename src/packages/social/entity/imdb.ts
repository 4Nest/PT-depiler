const imdbUrlPattern = /^(?:https?:\/\/)?(?:www\.)?imdb\.com\/title\/(tt\d+)\/?/;

export function build(id: string): string {
  return `https://www.imdb.com/title/${id}/`;
}

export function parse(query: string | number | undefined): string {
  if (typeof query !== "undefined") {
    query = String(query).trim();
    // Extract the IMDb ID from the URL.
    const imdbUrlMatch = query.match(imdbUrlPattern);
    if (imdbUrlMatch) {
      return imdbUrlMatch[1] as string;
    }

    if (/^tt(\d+)/.test(query)) {
      query = query.replace(/^tt(\d+)/, "$1");
    }

    // 如果是纯数字的字符串，则补齐并返回
    if (/^\d+$/.test(query)) {
      return "tt" + (query.length < 7 ? query.padStart(7, "0") : query);
    }
  }

  return query as unknown as string;
}
