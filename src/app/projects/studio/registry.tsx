"use client";
// EVERY KIND OF STUDIO, FOR THE BROWSER (08.11.2026). Each loads only when a to-do of its kind opens.
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { StudioKind } from "@/lib/content/studio/kinds";
import type { StudioApi } from "./useStudio";

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
