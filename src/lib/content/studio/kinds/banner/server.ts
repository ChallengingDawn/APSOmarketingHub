// BANNER - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). A first shape; its own session fills it out.
import type { KindDef } from "../../contract";
import { emptyBanner, bannerText } from "./model";

export const bannerKind: KindDef = {
  kind: "banner",
  channel: "ad",
  empty: () => emptyBanner(),
  toText: bannerText,
  tasks: {},
};
