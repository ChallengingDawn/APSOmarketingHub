// SOCIAL POST - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). A first shape; its own session fills it out.
import type { KindDef } from "../../contract";
import { emptySocial, socialText } from "./model";

export const socialKind: KindDef = {
  kind: "social",
  channel: "linkedin",
  empty: () => emptySocial(),
  toText: socialText,
  tasks: {},
};
