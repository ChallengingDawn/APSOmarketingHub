// PAGE - THE LIBRARY, PART 2: its modules, in one list (Content v7, 10.11.2026). ../library.ts spreads it into the library.
//
// Eight categories (../registry.ts CATEGORIES): Content & stories, Technical & comparison, Tools & services, Help & FAQ,
// Calls to action & sign-ups, Industries & applications, References & brands, Media. SAMPLES2: what a module shows in the
// gallery's thumbnail beyond its defaults (the shop's real de-CH data a fill would bring).

import type { ModuleDef, ModuleSettings } from "../types";
import { STORIES, STORY_SAMPLES } from "./stories";

export const LIBRARY2: ModuleDef[] = [...STORIES];
export const SAMPLES2: Record<string, (store: string) => Partial<ModuleSettings>> = { ...STORY_SAMPLES };
