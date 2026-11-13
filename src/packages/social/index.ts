import { TSupportSocialSite } from "./types.ts";

export * from "./types.ts";

interface socialEntity {
  parse: (query: string) => string;
  build: (id: string) => string;
}

export const socialContent = import.meta.glob<socialEntity>("./entity/*.ts", { eager: true });
export const socialEntityList = Object.keys(socialContent).map((value: string) => {
  return value.replace(/^\.\/entity\//, "").replace(/\.ts$/, "");
}) as TSupportSocialSite[];

export type TSupportSocialSite$1 = (typeof socialEntityList)[number];

export const socialBuildUrlMap = {} as Record<TSupportSocialSite$1, socialEntity["build"]>;
export const socialParseUrlMap = {} as Record<TSupportSocialSite$1, socialEntity["parse"]>;

export function getSocialModule(site: TSupportSocialSite$1): socialEntity {
  return socialContent[`./entity/${site}.ts`];
}

for (const socialEntity of socialEntityList) {
  const socialModule = getSocialModule(socialEntity);

  socialBuildUrlMap[socialEntity] = socialModule.build;
  socialParseUrlMap[socialEntity] = socialModule.parse;
}
