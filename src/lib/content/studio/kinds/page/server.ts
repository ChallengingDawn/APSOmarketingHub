// PAGE - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). A first shape; its own session fills it out.
import type { KindDef } from "../../contract";
import { emptyPage, pageText } from "./model";

export const pageKind: KindDef = {
  kind: "page",
  channel: "seo",
  empty: () => emptyPage(),
  toText: pageText,
  tasks: {},
};
