// EVERY KIND OF STUDIO, FOR THE SERVER (08.11.2026). One import per kind; each kind's own folder holds the rest.
import type { KindDef } from "./contract";
import type { StudioKind } from "./kinds";
import { pageKind } from "./kinds/page/server";
import { blogKind } from "./kinds/blog/server";
import { socialKind } from "./kinds/social/server";
import { newsletterKind } from "./kinds/newsletter/server";
import { bannerKind } from "./kinds/banner/server";
import { videoKind } from "./kinds/video/server";

export const KIND_DEFS: Record<StudioKind, KindDef> = {
  page: pageKind, blog: blogKind, social: socialKind, newsletter: newsletterKind, banner: bannerKind, video: videoKind,
};
