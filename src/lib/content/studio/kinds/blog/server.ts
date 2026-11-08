// BLOG POST - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). A first shape; its own session fills it out.
import type { KindDef } from "../../contract";
import { emptyBlog, blogText } from "./model";

export const blogKind: KindDef = {
  kind: "blog",
  channel: "blog",
  empty: () => emptyBlog(),
  toText: blogText,
  tasks: {},
};
