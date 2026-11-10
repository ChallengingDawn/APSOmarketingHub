// THE MODULE LIBRARY: every module file, in one list (Content v7, 10.11.2026). ./registry.ts reads it; nothing else should.
//
// To add modules: a file in ./lib/ exporting a `ModuleDef[]` (./types.ts), drawn with the kit (./kit.ts), and ONE line
// here. Builder B owns heroes, showcases, bentos, navigation, campaigns, trust; builder B2 stories, technical, tools, help,
// cta, industries, references, media (each its own files - add your import and your spread below, nothing else).
// The order here is the order inside a category in the Modules tab.

import type { ModuleDef } from "./types";
import { V6 } from "./lib/v6";
import { HEROES } from "./lib/heroes";
import { SHOWCASES } from "./lib/showcases";
import { BENTOS } from "./lib/bentos";
import { NAVIGATION } from "./lib/navigation";
import { CAMPAIGNS } from "./lib/campaigns";
import { TRUST } from "./lib/trust";
import { LIBRARY2 } from "./library2";

export const LIBRARY: ModuleDef[] = [
  ...HEROES,
  ...V6,
  ...SHOWCASES,
  ...BENTOS,
  ...NAVIGATION,
  ...CAMPAIGNS,
  ...TRUST,
  ...LIBRARY2,
];
