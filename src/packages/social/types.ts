export const supportSocialSite = ["imdb", "douban", "bangumi", "anidb", "tvmaze", "tmdb"] as const;
export type TSupportSocialSite = (typeof supportSocialSite)[number];

export type TUrlPattern = string | RegExp;
