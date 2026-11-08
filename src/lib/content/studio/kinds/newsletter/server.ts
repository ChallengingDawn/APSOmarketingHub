// NEWSLETTER - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). Filled out in this session tonight.
import type { KindDef } from "../../contract";
import { emptyNewsletter, newsletterText } from "./model";

export const newsletterKind: KindDef = {
  kind: "newsletter",
  channel: "newsletter",
  empty: () => emptyNewsletter(),
  toText: newsletterText,
  tasks: {},
};
