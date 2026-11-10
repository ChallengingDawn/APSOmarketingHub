// PAGE - THE LIBRARY, PART 2: its modules, in one list (Content v7, 10.11.2026). ../library.ts spreads it into the library.
//
// Eight categories (../registry.ts CATEGORIES): Content & stories, Technical & comparison, Tools & services, Help & FAQ,
// Calls to action & sign-ups, Industries & applications, References & brands, Media. SAMPLES2: what a module that takes
// the shop's categories or products shows in the gallery's thumbnail (what a fill would bring, the shop's real de-CH data).

import type { ModuleDef, ModuleSettings } from "../types";
import { DRIVE, ORING, PLASTICS, PRODUCTS, SEALING } from "./data";
import { STORIES } from "./stories";
import { TECHNICAL } from "./technical";
import { TOOLS } from "./tools";
import { HELP } from "./help";
import { CTA } from "./cta";
import { INDUSTRIES } from "./industries";
import { BRANDS } from "./brands";
import { MEDIA } from "./media";

export const LIBRARY2: ModuleDef[] = [...STORIES, ...TECHNICAL, ...TOOLS, ...HELP, ...CTA, ...INDUSTRIES, ...BRANDS, ...MEDIA];

export const SAMPLES2: Record<string, (store: string) => Partial<ModuleSettings>> = {
  // the materials' own categories (their photo and page)
  "story-tabs": () => ({ items: ["NBR", "FKM", "EPDM", "VMQ", "FFKM"].map((k) => ORING[k]) }),
  // plastics and sealing sheets around the cutting machine
  "ind-around": () => ({ items: [PLASTICS[0], PLASTICS[1], PLASTICS[2], SEALING[4], SEALING[3], DRIVE[0]] }),
  // the evolast® O-rings as the O-ring category lists them
  "brand-spotlight": () => ({ items: [PRODUCTS[3], PRODUCTS[4]] }),
};
