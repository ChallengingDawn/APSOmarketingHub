// THE FILM'S ICONS AS SVG PATHS (08.11.2026): the shop's own 24 px line icons (home-page-2026 gen_home_concepts.py
// ICON) and four drawn the same way (truck, grid, chat, pin). Pure - drawn by icons.tsx and the feature picker.
import type { IconKey } from "../features";

export const ICON_PATHS: Record<IconKey, string> = {
  box: '<path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5 12 13l8-4.5M12 13v7"/>',
  directcut: '<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M7.8 16.2 17 4M16.2 16.2 7 4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  quick: '<circle cx="12" cy="13.5" r="7"/><path d="M12 10v3.5l2.2 1.6M10 3.5h4M12 3.5v3"/>',
  expert: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5 20 4"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 14v4.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V14"/>',
  cube: '<path d="M12 3.5 19.5 7.7v8.6L12 20.5l-7.5-4.2V7.7z"/><path d="M4.5 7.7 12 12l7.5-4.3M12 12v8.5"/>',
  user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1"/><circle cx="4.8" cy="12" r="1"/><circle cx="4.8" cy="17.5" r="1"/>',
  // drawn here, in the same line
  truck: '<path d="M2.5 6.5h11v9.5h-11z"/><path d="M13.5 9.5h4.2l3.3 3.4V16h-7.5"/><circle cx="7" cy="17.6" r="1.9"/><circle cx="17.2" cy="17.6" r="1.9"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
  chat: '<path d="M4.5 5.5h15v10h-8.2L7 19v-3.5H4.5z"/><path d="M8.5 9.5h7M8.5 12.5h4.5"/>',
  pin: '<path d="M12 20.5s6-5.6 6-10.5a6 6 0 0 0-12 0c0 4.9 6 10.5 6 10.5z"/><circle cx="12" cy="10" r="2.2"/>',
};
