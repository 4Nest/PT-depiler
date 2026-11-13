export function build(id: string): string {
  return `https://www.themoviedb.org/${parse(id)}`;
}

export function parse(query: string | number | undefined): string {
  if (typeof query === "undefined") {
    return query as unknown as string;
  }

  const normalizedQuery = String(query).trim();
  const match = normalizedQuery.match(
    /(?:https?:\/\/)?(?:www\.)?themoviedb\.org\/((?:movie|tv)\/\d+)(?:-[^/?#]+)?((?:\/season\/\d+(?:\/episode\/\d+)?)?)\/?(?:\?.*)?$/,
  );

  if (match) {
    return `${match[1]}${match[3] ?? ""}`;
  }

  const idMatch = normalizedQuery.match(/^(movie|tv)\/\d+(?:\/season\/\d+(?:\/episode\/\d+)?)?$/);
  if (idMatch) {
    return idMatch[0];
  }

  return normalizedQuery;
}
