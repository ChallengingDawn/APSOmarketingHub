"use client";
// EVERY KIND OF STUDIO, FOR THE BROWSER (08.11.2026). Each loads only when a to-do of its kind opens.
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { StudioKind } from "@/lib/content/studio/kinds";
import type { StudioApi } from "./useStudio";
import type { DownloadsOf } from "./frame";

export type StudioProps = { api: StudioApi };

const opening = () => null;

export const STUDIOS: Record<StudioKind, ComponentType<StudioProps>> = {
  page: dynamic(() => import("./kinds/page/Studio"), { ssr: false, loading: opening }),
  blog: dynamic(() => import("./kinds/blog/Studio"), { ssr: false, loading: opening }),
  social: dynamic(() => import("./kinds/social/Studio"), { ssr: false, loading: opening }),
  newsletter: dynamic(() => import("./kinds/newsletter/Studio"), { ssr: false, loading: opening }),
  banner: dynamic(() => import("./kinds/banner/Studio"), { ssr: false, loading: opening }),
  video: dynamic(() => import("./kinds/video/Studio"), { ssr: false, loading: opening }),
};

/**
 * WHAT EACH KIND GIVES AS FILES, for the bar's Download (Content v7, SARCLA 10.11.2026: "on the top bar we should also be
 * able to download"): a small module per kind, loaded when the menu opens - the page's HTML for Magento per store view and
 * a picture of it, a banner's PNG / WebP per size, a post's pictures, a newsletter's and a blog post's HTML, the film's
 * story for the render machine.
 */
export const DOWNLOADS: Partial<Record<StudioKind, () => Promise<DownloadsOf>>> = {
  page: () => import("./kinds/page/downloads").then((m) => m.downloads),
  banner: () => import("./kinds/banner/downloads").then((m) => m.downloads),
  social: () => import("./kinds/social/downloads").then((m) => m.downloads),
  newsletter: () => import("./kinds/newsletter/downloads").then((m) => m.downloads),
  blog: () => import("./kinds/blog/downloads").then((m) => m.downloads),
  video: () => import("./kinds/video/downloads").then((m) => m.downloads),
};
