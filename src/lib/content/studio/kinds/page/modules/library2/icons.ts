// PAGE - THE LIBRARY, PART 2: the line icons its modules add to the kit's (Content v7, 10.11.2026). Pure data, no imports:
// ../kit.ts spreads them into its own ICON map (the kit's own keys win), so points keep them when a module is read back.
// 24 px, the kit's stroke (1.7, round): industries, media, help and tools.

export const L2_ICON_PATHS: Record<string, string> = {
  drop: '<path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-3.5-9.5C12 7 10 9.5 10 12c-1-.8-1.6-2-1.8-3C6.8 10.6 6 12.6 6 15a6 6 0 0 0 6 6z"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
  mail: '<path d="M3.5 6.5h17v11h-17z"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 16v2.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V16"/>',
  factory: '<path d="M3.5 20.5v-9l5 3v-3l5 3v-3l5 3v-10h2v16z"/><path d="M3.5 20.5h17"/>',
  food: '<path d="M7 3.5v7a2 2 0 0 0 4 0v-7M9 10.5v10M16.5 20.5v-17c-2 1-3 3.5-3 7h3"/>',
  pharma: '<rect x="3.6" y="9" width="16.8" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="m9.9 9.9 4.2 4.2"/>',
  bolt: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z"/>',
  car: '<path d="M4 15.5v-3l2-5h12l2 5v3z"/><path d="M4 12.5h16"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  wave: '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  pin: '<path d="M12 21s6.5-6.2 6.5-11a6.5 6.5 0 0 0-13 0c0 4.8 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  filter: '<path d="M4 5.5h16l-6.2 7.2v5.8l-3.6 1.8v-7.6z"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.5"/><path d="M12 16.8v.2"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="5" cy="6.5" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17.5" r="1"/>',
  ring: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4.5"/>',
  water: '<path d="M3.5 9c2.8-2 5.7-2 8.5 0s5.7 2 8.5 0M3.5 15c2.8-2 5.7-2 8.5 0s5.7 2 8.5 0"/>',
  wrench: '<path d="M14.5 4a4.5 4.5 0 0 0-4 6.2L4 16.7 7.3 20l6.5-6.5A4.5 4.5 0 0 0 20 9.5l-2.8 2.8-3-.5-.5-3L16.5 6a4.5 4.5 0 0 0-2-.5z"/>',
  arrow: '<path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5"/>',
  hose: '<path d="M4 8.5h4c4.5 0 4.5 7 9 7h3"/><path d="M4 5.5v6M20 12.5v6"/>',
};

export const L2_ICON_LABEL: Record<string, string> = {
  drop: "Water drop", flame: "Heat", snow: "Cold", mail: "Mail", play: "Video", download: "Download", factory: "Plant", food: "Food",
  pharma: "Pharma", bolt: "Energy", car: "Vehicles", chip: "Electronics", wave: "Vibration", pin: "Place", filter: "Filter",
  question: "Question", user: "Person", list: "List", ring: "O-ring", water: "Water", wrench: "Maintenance", arrow: "Arrow", hose: "Hose",
};
