// SEARCH BAR - every view the shop's search bar can show, depending on what the customer types (SARCLA
// 17.10.2026: "create another tab dynamic views with all dynamic views"). Read from the widget's own router
// (smart-search.js onQueryChange / classifyQuery, build .168), and every example was run through that router
// and reached the view named here - routing only: a view that needs the gateway's data can still fall back
// when the gateway has nothing. `tiers` are what the bar logs for the view (the Searches tab's "answered as");
// a `*` stands for the category in the middle (drivepart-coupling-dim).
// Views a customer can never see (switched off or never called) are left out.

export const GROUPS = ["Core", "Sealing", "Plastics", "Hoses & fluid", "Drive & motion", "Anti-vibration", "Other categories"] as const;
export type ViewGroup = (typeof GROUPS)[number];
export type BarView = { id: string; group: ViewGroup; name: string; what: string; examples: string[]; hint?: string; tiers: string[] };

export const VIEWS: BarView[] = [
  // ── Core ──
  { id: "featured-idle", group: "Core", name: "Featured products", what: "Before anything is typed: the \"Featured today\" grid of recommended products (the Featured tab's, else a built-in best-seller set), as a grid or a list.", examples: [], hint: "Click into the empty bar on any shop page.", tiers: [] },
  { id: "article-number-keep-typing", group: "Core", name: "Keep typing the article number", what: "A short banner asking the customer to keep typing while a dotted or prefixed article number is still too short to look up.", examples: ["11.4", "dt 115"], tiers: [] },
  { id: "profit-centre-landing", group: "Core", name: "Offer code landing", what: "An offer prefix (DT, KT, AT, ST, FT, PW) shows which product family the code means and asks for the number, above that family's overview page.", examples: ["dt", "kt", "ft"], tiers: [] },
  { id: "article-number", group: "Core", name: "Article number lookup", what: "An article or product number opens that exact article as a card (photo, specs, stock, cart) with alternatives from its family; a partial number lists the matching articles and narrows as you type; a customer's own number gets a Quick Order card.", examples: ["1140050125", "11400501", "dt 1150"], tiers: ["sku"] },
  { id: "material-page", group: "Core", name: "Material overview page", what: "One material's banner (name, temperature range, hardness, certificates) over one product grid with category tabs; \"ffkm sheet\" opens it on its Sheets tab; a near-miss spelling opens the material it resembles.", examples: ["nbr", "viton", "ffkm sheet"], tiers: ["material", "material-fuzzy", "sheet-mat"] },
  { id: "house-brand-page", group: "Core", name: "House-brand page", what: "For the seal brands (HITEC, NORMATEC, EVOLAST, KALREZ, PERTEC, FEP-O-SEAL): a brand banner with tagline, temperature span and certificates over that brand's products.", examples: ["hitec", "evolast", "kalrez"], tiers: [] },
  { id: "category-grid", group: "Core", name: "Category product grid", what: "Any product word without its own view: a banner with the category name and count over product cards from the catalogue, or the shop's own suggestions.", examples: ["bearing", "plug", "door seal"], tiers: ["product-type"] },
  { id: "product-at-size", group: "Core", name: "Product at a size", what: "A size with a product word other than O-ring: the best-matching product as an article card with its attributes, then the other matches.", examples: ["profile 10x5", "u-profile 10x5"], tiers: ["article"] },
  { id: "no-results", group: "Core", name: "No results", what: "When nothing matches: \"keep typing\" for 3 characters or fewer, otherwise the assistant chat opens with the search.", examples: [], hint: "Any search the catalogue cannot place.", tiers: [] },
  { id: "assistant-chat", group: "Core", name: "APSO Assistant chat", what: "A question opens the assistant: it answers, shows suggested products beside the chat and can hand over to a specialist with a contact form. A material asked for outside its temperature range opens it too.", examples: ["what o-ring do I need for hot water?", "can you help me?", "nbr 150°c"], tiers: ["assistant", "temp-out-of-range"] },
  { id: "temperature", group: "Core", name: "Materials for a temperature", what: "Material cards ranked by how well they cover the typed temperature (a range bar with the temperature marked), filtering one product grid; a product word narrows it.", examples: ["120°c", "-40", "o-ring 80°c"], tiers: ["temperature", "temp-filter"] },
  { id: "certified-products", group: "Core", name: "Certified products", what: "Every product with a named certificate (FDA, EC 1935, WRAS, NSF, USP …) across materials and product types, in material tabs; a material or product word narrows it.", examples: ["fda", "nbr fda", "hose fda"], tiers: ["cert"] },
  { id: "food-beverage", group: "Core", name: "Food & beverage range", what: "The whole food-contact range on one page: food hoses first, then food-certified seals, O-rings and plastics, in tabs.", examples: ["food", "food and beverage", "lebensmittel"], tiers: ["food-bev"] },
  { id: "datasheets", group: "Core", name: "Technical data sheets", what: "Downloadable data sheets for each A+P compound, with a picture of the product family using it, in material tabs (a typed material opens its tab).", examples: ["datasheet pom-c", "tds nbr", "datenblatt nbr"], tiers: ["datasheets"] },

  // ── Sealing ──
  { id: "sealing-overview", group: "Sealing", name: "Sealing technology overview", what: "One tab per seal family (O-rings, X-rings, shaft seals, hydraulic, gasket sheets, flat gaskets, rubber sheets, profiles & cords, filters) with its product grid.", examples: ["seal", "joint", "dichtung"], tiers: ["seal-aggregate"] },
  { id: "o-ring-catalogue", group: "Sealing", name: "O-ring catalogue", what: "The O-ring page: one tab per material (NBR, FKM, EPDM, VMQ, HNBR, FFKM, PTFE …) over the O-ring families; a bare number (the start of a size) opens it too.", examples: ["o-ring", "joint torique", "50"], tiers: ["oring-catalog", "figure"] },
  { id: "o-rings-one-material", group: "Sealing", name: "O-rings in one material", what: "That material's O-rings in Standard and Certified tabs with the real temperature span; a brand or grade code narrows it.", examples: ["o-ring fkm", "viton o-ring", "fkm 75.16-04"], tiers: ["oring-material"] },
  { id: "certified-o-rings", group: "Sealing", name: "Certified O-rings", what: "Only the O-rings with the named certificate, in material tabs when several materials qualify.", examples: ["o-ring fda", "nbr o-ring fda", "epdm o-ring wras"], tiers: ["oring-cert"] },
  { id: "o-rings-at-size", group: "Sealing", name: "O-rings at a size", what: "Every O-ring at the typed inner diameter × cord, grouped by material in a table (size, hardness, colour, certificates, stock, cart); a size not stocked shows the nearest standard sizes.", examples: ["20x2", "o-ring 20x2", "o-ring 12x2"], tiers: ["dimension"] },
  { id: "o-ring-size-material", group: "Sealing", name: "O-ring by size & material", what: "The exact ring for a material and size as article cards, standard (NORMATEC) beside certified (HITEC), with a comparison and a table of all alternatives; a certificate in the search picks a ring that holds it.", examples: ["o-ring 20x2 nbr", "nbr 20x2", "hitec fkm 20x2"], tiers: ["material-dim"] },
  { id: "shaft-seals", group: "Sealing", name: "Radial shaft seals", what: "A shaft-seal banner (DIN 3760, NBR/FKM temperatures) with the families grouped by material; cards show form, brand tier, material, temperature and article count.", examples: ["radial shaft seal", "rwdr", "simmerring"], tiers: ["rwdr"] },
  { id: "shaft-seals-at-size", group: "Sealing", name: "Shaft seals at a size", what: "Shaft seals for shaft × outer × width (or the shaft alone), exact first, else the nearest sizes.", examples: ["30x52x7", "rwdr 30x47x7", "shaft seal 30"], tiers: ["rwdr-dim"] },
  { id: "x-rings", group: "Sealing", name: "X-rings / quad rings", what: "The X-ring family page: NBR banner, AS568 sizes, product cards.", examples: ["x-ring", "quad ring"], tiers: ["xring"] },
  { id: "x-rings-at-size", group: "Sealing", name: "X-rings at a size", what: "X-rings at the typed inner diameter × cord in a table, else the nearest sizes.", examples: ["x-ring 10x2", "x-ring 20x2 nbr"], tiers: ["xring-dim"] },
  { id: "hydraulic-seals", group: "Sealing", name: "Hydraulic & pneumatic seals", what: "Rod, piston and wiper seals and guide tapes in tabs; cards lead with the profile code and the PU/PTFE material.", examples: ["hydraulic seal", "piston seal", "wiper"], tiers: ["hyd"] },
  { id: "hydraulic-seals-at-size", group: "Sealing", name: "Hydraulic seals at a size", what: "A table of the seals for the typed rod or bore diameter.", examples: ["rod seal 50", "piston seal 50", "wiper 30"], tiers: ["hyd-dim"] },
  { id: "gasket-sheets", group: "Sealing", name: "Gasket sheets", what: "High-tech sealing sheets (NOVAPRESS, NOVATEC, NOVAFLON, NOVAFORM) in material tabs, cards with their certificates.", examples: ["gasket sheet", "novaflon", "sealing plate"], tiers: ["seal-plate"] },
  { id: "gasket-sheets-at-thickness", group: "Sealing", name: "Gasket sheets at a thickness", what: "All gasket sheets at the typed thickness, grouped by material, exact or nearest.", examples: ["novaflon 2mm", "sealing plate 2mm", "gasket sheet 3mm"], tiers: ["seal-plate-dim"] },
  { id: "flat-gaskets", group: "Sealing", name: "Flat gaskets", what: "Flat, spiral-wound and screw seals in tabs with family cards.", examples: ["flat gasket", "spiral gasket", "dichtring"], tiers: ["flatgasket"] },
  { id: "flat-gaskets-at-size", group: "Sealing", name: "Flat gaskets by flange size", what: "Gaskets for a DN flange size (flat and spiral), or screw seals by inner diameter, in a table with the nearest sizes.", examples: ["dn 50 flat gasket", "dn 100 spiral gasket", "screw seal 10"], tiers: ["flatgasket-dim"] },
  { id: "rubber-sheets", group: "Sealing", name: "Rubber sheets", what: "Elastomer plates (NBR, EPDM, CR, SBR, NR, VMQ, FKM) with family cards; a rubber with a plate or sheet word opens its tab.", examples: ["rubber plate", "epdm plate", "plaque caoutchouc"], tiers: ["elastomer-plate"] },
  { id: "foam-rubber-sheets", group: "Sealing", name: "Foam rubber sheets", what: "Cellular rubber plates (CR, EPDM, VMQ) with their thickness ranges.", examples: ["cellular rubber", "moosgummi"], tiers: [] },
  { id: "rubber-floor-mats", group: "Sealing", name: "Rubber floor mats", what: "Ribbed and studded rubber floor mats.", examples: ["floor mat", "rubber floor mat"], tiers: [] },
  { id: "pvc-cork-paper-sheets", group: "Sealing", name: "Soft-PVC, cork & paper sheets", what: "Soft-PVC sheet, rubber-cork and oiled jointing paper.", examples: ["soft pvc", "cork rubber", "oiled paper"], tiers: [] },
  { id: "rubber-sheets-at-thickness", group: "Sealing", name: "Rubber sheets at a thickness", what: "A thickness table of the matching rubber, foam-rubber or covering sheets, narrowed to a named rubber.", examples: ["epdm plate 3mm", "sbr 5", "foamed plate 10 mm"], tiers: ["pcov-dim"] },
  { id: "profiles", group: "Sealing", name: "Profiles, cords & strips", what: "Extruded profiles, round cords and sealing strips with group tabs and a family grid.", examples: ["profile", "sealing strip", "edge protection"], tiers: ["profiles"] },
  { id: "round-cord-at-size", group: "Sealing", name: "Round cord at a diameter", what: "Round cord at the typed cord diameter in a table.", examples: ["round cord 5", "nbr round cord 6"], tiers: ["roundcord-dim"] },
  { id: "filters-insulation", group: "Sealing", name: "Filters & insulation", what: "Heat protection and insulation, filter mats and foams, fluid filter plates and paint-stop in tabs; insulation sorted by maximum temperature.", examples: ["filter", "insulation", "isoglas"], tiers: ["filters"] },
  { id: "filters-at-thickness", group: "Sealing", name: "Filters & insulation at a thickness", what: "Filter and insulation articles at the typed thickness (or insulating-cord diameter).", examples: ["filter foam 30mm", "isoglas 10mm"], tiers: ["filters-dim"] },
  { id: "foam", group: "Sealing", name: "Foam & cellular rubber", what: "Every foam product of the catalogue on one page (foam rubber plates, foamed profiles and cords, foam tapes, filter foam) in tabs.", examples: ["foam", "sponge rubber", "epdm foam"], tiers: ["foam"] },

  // ── Plastics ──
  { id: "plastics-overview", group: "Plastics", name: "Engineering plastics overview", what: "A tab per shape (plates, round bars, tubes, slide bearings, foils, adhesive tapes, hoses) with that shape's products.", examples: ["plastics", "engineering plastics", "kunststoffe"], tiers: ["plastic-aggregate"] },
  { id: "sheets-chooser", group: "Plastics", name: "Sheets & plates chooser", what: "One tab per material, covering plastic sheets as well as rubber and gasket sheets.", examples: ["sheet", "plate"], tiers: ["sheet-catalog"] },
  { id: "plastic-material", group: "Plastics", name: "Plastic material page", what: "One engineering plastic in every shape (plates, round bars, tubes, slide bearings, its foils, tapes and hoses), tabbed by shape with the sizes; a certificate keeps only the grades that hold it.", examples: ["peek", "makrolon", "pom fda"], tiers: ["plastic-material"] },
  { id: "plastic-plates", group: "Plastics", name: "Plastic plates", what: "Engineering-plastic plates and sheets by material; a plastic (or its brand) with a plate word narrows it to that plastic.", examples: ["plastic plate", "pom plate", "ptfe plate food"], tiers: ["plates"] },
  { id: "plastic-plates-at-thickness", group: "Plastics", name: "Plastic plates at a thickness", what: "Plates at the typed thickness (or a cut length × width matched to the stock formats), for the material and grade.", examples: ["pom plate 10 mm", "ptfe sheet 2mm", "pet c sl 750x250"], tiers: ["plate-dim"] },
  { id: "round-bars", group: "Plastics", name: "Plastic round bars", what: "Round bars by material (or one material); cards lead with diameter range and length.", examples: ["round bar", "pom rod", "peek round bar"], tiers: ["rods"] },
  { id: "round-bars-at-diameter", group: "Plastics", name: "Round bars at a diameter", what: "Round bars at the typed diameter, for the material and grade, the nearest when none.", examples: ["pom rod 20", "ptfe rod 30mm", "pom 20"], tiers: ["rod-dim"] },
  { id: "plastic-tubes", group: "Plastics", name: "Plastic tubes", what: "Engineering-plastic tubes by material.", examples: ["tube", "pom tube", "plastic tube"], tiers: ["tubes"] },
  { id: "plastic-tubes-at-diameter", group: "Plastics", name: "Tubes at an outer diameter", what: "Tubes at the typed outer diameter (outer, inner, wall).", examples: ["pa tube 30"], tiers: ["tube-dim"] },
  { id: "slide-bearings", group: "Plastics", name: "Plastic slide bearings", what: "Plastic bushings in form tabs (bush, flanged, thrust).", examples: ["slide bearing", "bushing", "pa bushing"], tiers: ["bushings"] },
  { id: "slide-bearings-at-bore", group: "Plastics", name: "Slide bearings at a bore", what: "Bushings at the typed bore diameter.", examples: ["ptfe bushing 8"], tiers: ["bush-dim"] },
  { id: "foils-glass-fabric", group: "Plastics", name: "Foils & glass fabric", what: "PTFE, PA and PE foils and PTFE-coated glass fabric by thickness.", examples: ["ptfe foil", "glass fabric"], tiers: ["film"] },
  { id: "adhesive-tapes", group: "Plastics", name: "Adhesive tapes", what: "Self-adhesive PTFE and UHMW sliding tapes by thickness and width.", examples: ["adhesive tape", "ptfe tape"], tiers: ["tape"] },
  { id: "foils-tapes-at-thickness", group: "Plastics", name: "Foils & tapes at a thickness", what: "Foil, fabric or tape at the typed thickness.", examples: ["glass fabric 0.2mm", "ptfe tape 0.1mm", "ptfe foil 0.5mm"], tiers: ["film-dim", "tape-dim"] },
  { id: "sustainable-plastics", group: "Plastics", name: "Sustainable plastics", what: "Bio-based and recycled (PIR) engineering-plastic grades on one page.", examples: ["recycled pom", "bio based plastics", "pir"], tiers: ["sustainable"] },

  // ── Hoses & fluid ──
  { id: "hoses", group: "Hoses & fluid", name: "Hoses", what: "Hose families by application (food, chemical, water, air, steam, oil & gas …) in tabs; a material or a hose brand narrows the same page.", examples: ["hose", "silicone hose", "chemolit"], tiers: ["hose", "hose-mat", "hose-brand"] },
  { id: "hoses-for-application", group: "Hoses & fluid", name: "Hoses for an application", what: "One hose application (food, water, industrial, protection …) with sub-type tabs.", examples: ["food hose", "drinking water hose", "steam hose"], tiers: ["hose-cat"] },
  { id: "hoses-at-diameter", group: "Hoses & fluid", name: "Hoses by inner diameter", what: "Hoses at the typed inner diameter (else the nearest) in a table grouped by application, with alternatives.", examples: ["hose 25", "water hose 25", "silicone hose 10"], tiers: ["hose-dim"] },
  { id: "hose-clamps", group: "Hoses & fluid", name: "Hose clamps", what: "Hose clamps as a product grid.", examples: ["hose clamp", "schlauchklemme"], tiers: ["hose-clamp"] },
  { id: "hose-clamps-at-diameter", group: "Hoses & fluid", name: "Hose clamps for a diameter", what: "The hose clamps whose clamping range covers the typed diameter, in a table.", examples: ["hose clamp 45", "schlauchklemme 45"], tiers: ["hose-clamp-dim"] },
  { id: "fittings", group: "Hoses & fluid", name: "Fittings & connections", what: "Fittings, couplings, pneumatics, KAPSTO protective parts and expansion joints by category or brand (VOSS, KAMLOK, STORZ, KAPSTO, LEGRIS, WILLBRANDT).", examples: ["fitting", "kamlok", "expansion joint"], tiers: ["fluid-cat", "fluid-brand"] },
  { id: "fittings-at-size", group: "Hoses & fluid", name: "Fittings at a size", what: "Fittings or expansion joints at the typed size or DN, the nearest when none.", examples: ["fitting 12", "pneumatic fitting 8", "expansion joint dn 100"], tiers: ["fluid-dim"] },

  // ── Drive & motion ──
  { id: "belts-overview", group: "Drive & motion", name: "Belts & drives", what: "Tabs for timing belts, V-belts, Poly-V and flat belts with their family cards.", examples: ["belts", "courroie", "riemen"], tiers: ["drive-launcher"] },
  { id: "timing-belts", group: "Drive & motion", name: "Timing belts", what: "Toothed belts: profile tabs (HTD, STD, T, AT …) over family cards; a profile, material or brand narrows them.", examples: ["timing belt", "at10", "synchroflex"], tiers: ["belts"] },
  { id: "timing-belts-at-size", group: "Drive & motion", name: "Timing belts at a size", what: "That belt profile at the typed width (or length) in a table, the closest sizes when none.", examples: ["htd 5m 15", "at10 25", "t5 10"], tiers: ["belt-dim"] },
  { id: "v-belts", group: "Drive & motion", name: "V-belts & flat belts", what: "V-belts, Poly-V and flat belts by profile, with family cards.", examples: ["v-belt", "poly-v", "flat belt"], tiers: ["vbelt"] },
  { id: "v-belts-at-length", group: "Drive & motion", name: "V-belts at a length", what: "That profile at the typed effective length in a table.", examples: ["spz 1000", "xpz 1250", "pk 1200"], tiers: ["vbelt-dim"] },
  { id: "drive-components", group: "Drive & motion", name: "Pulleys, couplings & clamping elements", what: "Timing pulleys, V-belt pulleys, couplings, clamping elements and accessories as family cards per category.", examples: ["timing pulley", "coupling", "clamping element"], tiers: ["drivepart-*"] },
  { id: "drive-components-at-size", group: "Drive & motion", name: "Drive components at a size", what: "That category at the typed size (teeth and bore, effective diameter, coupling or shaft diameter …) in a table.", examples: ["coupling 40", "timing pulley 20", "taper lock 30"], tiers: ["drivepart-*-dim"] },
  { id: "clamping-chooser", group: "Drive & motion", name: "Clamping: which one?", what: "Two tabs, because two products share the name: clamping profiles (sealing) and clamping elements (drive).", examples: ["clamping", "klemmen"], tiers: ["clamping-hub"] },

  // ── Anti-vibration ──
  { id: "anti-vibration", group: "Anti-vibration", name: "Anti-vibration products", what: "APSOvib/ECOVIB mounts, buffers and springs, insulating plates, air springs and levelling feet in category tabs; a specific word opens its tab.", examples: ["anti-vibration", "air spring", "leveling mount"], tiers: ["antivib", "antivib-*"] },
  { id: "anti-vibration-at-size", group: "Anti-vibration", name: "Anti-vibration at a size", what: "That category at the typed load, diameter or thickness in a table, the closest when none.", examples: ["buffer 50", "air spring 100", "insulating plate 10"], tiers: ["antivib-*-dim"] },
  { id: "anti-vibration-by-load", group: "Anti-vibration", name: "Mounts for a load", what: "Mounts, springs and levelling feet of every category whose static load is near the typed value, in a table.", examples: ["anti-vibration mount 100 kg", "mount 50 kg"], tiers: ["antivib-load"] },

  // ── Other categories ──
  { id: "sensors-power", group: "Other categories", name: "Sensors & power", what: "Power supplies, gas sensors and power semiconductors on one page with category tabs.", examples: ["sensors and power"], tiers: ["senspwr"] },
  { id: "sensors-power-category", group: "Other categories", name: "Power supplies / gas sensors", what: "One category (power supplies, gas sensors or semiconductors) with its family table.", examples: ["power supply", "mean well", "gas sensor"], tiers: ["senspwr-cat"] },
  { id: "sensors-power-at-rating", group: "Other categories", name: "Power supplies by wattage", what: "Power supplies by output wattage, or semiconductors by blocking voltage, in a table, the nearest when none.", examples: ["power supply 480w", "semiconductor 1200v"], tiers: ["senspwr-dim"] },
  { id: "gas-springs-discontinued", group: "Other categories", name: "Gas springs (discontinued)", what: "A notice that gas springs are no longer sold, pointing the customer to SUSPA with their A+P article number.", examples: ["gas spring", "gasdruckfeder"], tiers: ["gas-spring"] },
];

/** The live shop, with the bar searching `q` as soon as it is on the page (the widget reads #apss-q=, .169).
 *  Only the fragment carries the search: it never reaches the shop's server. */
export const tryUrl = (store: string, q: string) => `https://www.apsoparts.com/${store}/#apss-q=${encodeURIComponent(q)}`;

/** What the bar logged a search as, in words: the view's name ("rod-dim" -> "Round bars at a diameter"). */
export function viewForTier(tier: string): BarView | null {
  for (const v of VIEWS) {
    for (const t of v.tiers) {
      if (t === tier) return v;
      if (t.includes("*")) {
        const re = new RegExp(`^${t.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\-]/g, "\\$&")).join("[a-z-]+")}$`);
        if (re.test(tier) && !(t === "antivib-*" && /-(dim|load)$/.test(tier)) && !(t === "drivepart-*" && /-dim$/.test(tier))) return v;
      }
    }
  }
  return null;
}
