// VIDEO - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). A first shape; its own session fills it out.
import type { KindDef } from "../../contract";
import { emptyVideo, videoText } from "./model";

export const videoKind: KindDef = {
  kind: "video",
  channel: "linkedin",
  empty: () => emptyVideo(),
  toText: videoText,
  tasks: {},
};
