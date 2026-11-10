// PAGE - THE LIBRARY, PART 2: what the shop itself shows, as its modules start from it (Content v7, 10.11.2026). Pure.
//
// Read from www.apsoparts.com/de-CH on 10.11.2026 (one page at a time): the home page's menu and tiles, the category pages,
// the Tools & Services page, the O-Ring selection guide (/support/o-ring-selection-guide), the help centre (/support/faqs),
// the tutorials page, About us, the grounding page (/groundingpage: the shop's own facts for AI search). Nothing here is
// invented: every name, sentence, figure, picture and address is the shop's own. Never a price, stock or a discount.
// German words for the German store views; the other store views get the addresses (./kit.ts pathFor) and write their words.

import type { Card } from "../types";
import { mk } from "./kit";

export const SHOP = "https://www.apsoparts.com";
const D = `${SHOP}/de-CH`;
const M = `${SHOP}/media`;
const CAT = (p: string) => `${M}/catalog/category/std.lang.all/${p}`;
const PROD = (p: string) => `${M}/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/${p}`;

/** The shop's tools and service pages (CMS pages: the same address in every store view, its prefix aside). */
export const LINKS = {
  service: "/de-CH/service",
  directcut: "/de-CH/service/directcut-configurator",
  oringExpert: "/de-CH/service/oring-expert",
  directup: "/de-CH/service/directup-order-upload",
  cad: "/de-CH/service/3d-cad-data",
  compat: "/de-CH/service/compatibilitytable",
  downloads: "/de-CH/technical-downloads",
  finder: "/de-CH/product-finder",
  logistics: "/de-CH/availability-and-logistics",
  quickorder: "/de-CH/quickorder/",
  support: "/de-CH/support",
  contact: "/de-CH/support/contact",
  faqs: "/de-CH/support/faqs",
  tutorials: "/de-CH/support/tutorials",
  about: "/de-CH/support/about-us",
  oringGuide: "/de-CH/support/o-ring-selection-guide",
  returns: "/de-CH/support/returns",
  newsletter: "/de-CH/newsletter/",
  create: "/de-CH/customer/account/create/",
  login: "/de-CH/customer/account/login/",
  search: "/de-CH/catalogsearch/result/",
};

/** The six technologies: the home page's own tiles (photo, line) and the category pages' counts. */
export const TECH: Card[] = [
  mk("category", "Dichtungstechnik", `${D}/dichtungstechnik.html`, `${M}/wysiwyg/1_Sealing_Technology_1.jpg`, "258 Produkte"),
  mk("category", "Kunststofftechnik", `${D}/kunststofftechnik.html`, `${M}/wysiwyg/2_EngeneeringPlasticsTechnology_1.jpg`, "180 Produkte"),
  mk("category", "Schwingungstechnik", `${D}/schwingungstechnik.html`, `${M}/wysiwyg/3_Antivibration_Technology_1.jpg`, "154 Produkte"),
  mk("category", "Fluidtechnik", `${D}/fluidtechnik.html`, `${M}/wysiwyg/4_Fluid_Handling_Technology_1.jpg`, "490 Produkte"),
  mk("category", "Antriebstechnik", `${D}/antriebstechnik.html`, `${M}/wysiwyg/5_Mechanical_Drive_Technology_1.jpg`, "341 Produkte"),
  mk("category", "Sensoren und Powertechnik", `${D}/sensoren-und-powertechnik.html`, `${M}/wysiwyg/6_Sensors_Power_1.jpg`, "137 Produkte"),
];
/** The home page's lines under each technology (its banner row "Weitere Produkte"), with the product brand. */
export const TECH_LINES: Record<string, { brand: string; line: string }> = {
  Dichtungstechnik: { brand: "APSOseal®", line: "Ein breites Spektrum an engineerten und standardisierten Komponenten für die Dichtungstechnik" },
  Kunststofftechnik: { brand: "APSOplast®", line: "Innovative Lösungen in der technischen Kunststofftechnik" },
  Schwingungstechnik: { brand: "APSOvib®", line: "Zukunftsweisende Technologien zur effizienten Unterdrückung von Vibrationen und Geräuschemissionen" },
  Fluidtechnik: { brand: "APSOfluid®", line: "Modernste Schläuche, Fittings und mehr für effizientes Fluid Handling" },
  Antriebstechnik: { brand: "APSOdrive®", line: "Optimale Antriebslösungen mit Standardkomponenten und kundenspezifischen Teilen" },
  "Sensoren und Powertechnik": { brand: "", line: "Die neuesten Sensoren und Energielösungen sowie eine Reihe von ergänzenden Produkten im Bereich Klebstoffe und Filter" },
};

/** The home page's large category banners (the "Top-Produkte" row): wide photos of the range. */
export const BANNERS: Card[] = [
  mk("category", "O-Ringe / X-Ringe", `${D}/dichtungstechnik/o-ringe-x-ringe.html`, `${M}/wysiwyg/1_ORings_XRings_1.jpg`, "Mehr als 24.000 Sortimentsartikel"),
  mk("category", "Rotationsdichtungen", `${D}/dichtungstechnik/rotationsdichtungen.html`, `${M}/wysiwyg/2_RotarySeals_1.jpg`, "In verschiedenen Abmessungen und Materialien"),
  mk("category", "Kunststoff-Platten", `${D}/kunststofftechnik/platte.html`, `${M}/wysiwyg/3_EngineeringPlasticsTechnology_Plates_1.jpg`, "Kunststoffhalbzeuge in Plattenform"),
  mk("category", "Profile, Rundschnüre und Bänder", `${D}/dichtungstechnik/profile-rundschnure-und-bander.html`, `${M}/wysiwyg/4_Profiles_RoundCords_Strips_1.jpg`, "Elastomerprofile in diversen Dimensionen"),
  mk("category", "Dichtungsplatten und Beläge", `${D}/dichtungstechnik/dichtungsplatten-und-belage.html`, `${M}/wysiwyg/5_Sealing_Plates_Coverings_2.jpg`, "Kautschuk, Faser und PTFE im Zuschnitt"),
  mk("category", "Kunststoff-Rundstäbe", `${D}/kunststofftechnik/rundstab.html`, `${M}/wysiwyg/6_EngineeringPlasticsTechnology_RoundBars_1.jpg`, "Kunststoffhalbzeuge in Stangenform"),
];

/** The O-ring materials: the category tiles of O-Ringe / X-Ringe. */
const OR = `${D}/dichtungstechnik/o-ringe-x-ringe`;
export const ORING: Record<string, Card> = {
  NBR: mk("category", "O-Ring NBR", `${OR}/o-ring-nbr.html`, CAT("44/02/resize/540-null/314402.jpg")),
  FKM: mk("category", "O-Ring FKM", `${OR}/o-ring-fkm.html`, CAT("43/99/resize/540-null/314399.jpg")),
  EPDM: mk("category", "O-Ring EPDM", `${OR}/o-ring-epdm.html`, CAT("44/01/resize/540-null/314401.jpg")),
  VMQ: mk("category", "O-Ring VMQ", `${OR}/o-ring-vmq.html`, CAT("44/00/resize/540-null/314400.jpg")),
  HNBR: mk("category", "O-Ring HNBR", `${OR}/o-ring-hnbr.html`, CAT("74/38/resize/540-null/457438.jpg")),
  PTFE: mk("category", "O-Ring PTFE", `${OR}/o-ring-ptfe.html`, CAT("74/39/resize/540-null/457439.jpg")),
  FFKM: mk("category", "O-Ring FFKM", `${OR}/o-ring-ffkm.html`, CAT("43/98/resize/540-null/314398.jpg")),
  FEP: mk("category", "O-Ring mit FEP-Ummantelung", `${OR}/o-ring-mit-fep-ummantelung.html`, CAT("44/03/resize/540-null/314403.jpg")),
  X: mk("category", "X-Ringe", `${OR}/x-ringe.html`, CAT("44/04/resize/540-null/314404.jpg")),
};
export const ORING_CAT = mk("category", "O-Ringe / X-Ringe", `${OR}.html`, `${M}/wysiwyg/1_ORings_XRings_1.jpg`, "31 Produkte");

/** Sealing technology's subcategories (its own tiles). */
const DT = `${D}/dichtungstechnik`;
export const SEALING: Card[] = [
  mk("category", "O-Ringe / X-Ringe", `${DT}/o-ringe-x-ringe.html`, CAT("44/46/resize/540-null/314446.jpg")),
  mk("category", "Rotationsdichtungen", `${DT}/rotationsdichtungen.html`, CAT("43/92/resize/540-null/314392.jpg")),
  mk("category", "Hubdichtungen und Führungsbänder", `${DT}/hubdichtungen-und-fuhrungsbander.html`, CAT("43/93/resize/540-null/314393.jpg")),
  mk("category", "Profile, Rundschnüre und Bänder", `${DT}/profile-rundschnure-und-bander.html`, CAT("43/96/resize/540-null/314396.jpg")),
  mk("category", "Dichtungsplatten und Beläge", `${DT}/dichtungsplatten-und-belage.html`, CAT("43/94/resize/540-null/314394.jpg")),
  mk("category", "Flachdichtungen", `${DT}/flachdichtungen.html`, CAT("43/95/resize/540-null/314395.jpg")),
  mk("category", "Formteile", `${DT}/formteile.html`, CAT("44/47/resize/540-null/314447.jpg")),
  mk("category", "Filter, Technische Gewebe, Isolationsmaterial", `${DT}/filter-technische-gewebe-isolationsmaterial.html`, CAT("07/46/resize/540-null/320746.jpg")),
];
/** Plastics, fluid, drive and antivibration subcategories the modules use (their own tiles). */
export const PLASTICS: Card[] = [
  mk("category", "Platte", `${D}/kunststofftechnik/platte.html`, CAT("95/32/resize/540-null/299532.jpg")),
  mk("category", "Rundstab", `${D}/kunststofftechnik/rundstab.html`, CAT("95/34/resize/540-null/299534.jpg")),
  mk("category", "Rohr", `${D}/kunststofftechnik/rohr.html`, CAT("95/35/resize/540-null/299535.jpg")),
  mk("category", "Gleitlager", `${D}/kunststofftechnik/gleitlager.html`, CAT("95/85/resize/540-null/299585.jpg")),
];
export const FLUID: Card[] = [
  mk("category", "Schläuche", `${D}/fluidtechnik/schlauche.html`, CAT("31/75/resize/540-null/323175.jpg")),
  mk("category", "Armaturen", `${D}/fluidtechnik/armaturen.html`, CAT("31/76/resize/540-null/323176.jpg")),
  mk("category", "Automation/Pneumatik", `${D}/fluidtechnik/automation-pneumatik.html`, CAT("31/77/resize/540-null/323177.jpg")),
  mk("category", "KAPSTO Schutzelemente", `${D}/fluidtechnik/kapsto-schutzelemente.html`, CAT("41/70/resize/540-null/324170.jpg")),
  mk("category", "Kompensator", `${D}/fluidtechnik/kompensator.html`, CAT("03/97/resize/540-null/970397.jpg")),
  mk("category", "Wellschlauch", `${D}/fluidtechnik/wellschlauch.html`, CAT("31/78/resize/540-null/323178.jpg")),
];
export const DRIVE: Card[] = [
  mk("category", "Zahnriemen", `${D}/antriebstechnik/zahnriemen.html`, CAT("47/76/resize/540-null/324776.jpg")),
  mk("category", "Keilriemen", `${D}/antriebstechnik/keilriemen.html`, CAT("47/79/resize/540-null/324779.jpg")),
  mk("category", "Kupplungen", `${D}/antriebstechnik/kupplungen.html`, CAT("47/78/resize/540-null/324778.jpg")),
];
export const VIB: Card[] = [
  mk("category", "Isolationsmatten", `${D}/schwingungstechnik/isolationsmatten.html`, CAT("93/22/resize/540-null/299322.jpg")),
  mk("category", "Maschinenrichtelemente", `${D}/schwingungstechnik/maschinenrichtelemente.html`, CAT("93/23/resize/540-null/299323.jpg")),
  mk("category", "Federelemente und Luftfedern", `${D}/schwingungstechnik/federelemente-und-luftfedern.html`, CAT("93/24/resize/540-null/299324.jpg")),
];

/** Products as the category pages list them (name, photo, the shop's own article count). */
export const PRODUCTS: Card[] = [
  mk("product", "HITEC® O-Ring NBR 70.10-02", `${D}/11400511-hitecr-o-ring-nbr-70-10-02.html`, PROD("62/50/296250.jpg"), "1043 Artikel", [], "11400511"),
  mk("product", "HITEC® O-Ring FKM 75.16-04", `${D}/11400711-hitecr-o-ring-fkm-75-16-04.html`, PROD("62/52/296252.jpg"), "719 Artikel", [], "11400711"),
  mk("product", "HITEC® O-Ring VMQ 70.10-01", `${D}/11400901-hitecr-o-ring-vmq-70-10-01.html`, PROD("62/53/296253.jpg"), "314 Artikel", [], "11400901"),
  mk("product", "FFKM O-Ring evolast® PN896", `${D}/10341001-ffkm-o-ring-evolastr-pn896.html`, PROD("73/94/977394.jpg"), "610 Artikel", [], "10341001"),
  mk("product", "FFKM O-Ring evolast® PN894", `${D}/10341002-ffkm-o-ring-evolastr-pn894.html`, PROD("73/95/977395.jpg"), "1756 Artikel", [], "10341002"),
  mk("product", "HITEC® O-Ring DW EPDM 70.503-00", `${D}/11400101-hitecr-o-ring-dw-epdm-70-503-00-nachfolge-von-hitecr-o-ring-epdm-70-10-02.html`, PROD("01/01/11400101.jpg"), "702 Artikel", [], "11400101"),
  mk("product", "PEEK Rundstab natur (braun-grau)", `${D}/01171545-peek-rundstab-natur-braun-grau.html`, PROD("58/71/295871.jpg"), "27 Artikel", [], "01171545"),
  mk("product", "PEEK Platte natur (braun-grau)", `${D}/02530001-peek-platte-natur-braun-grau.html`, PROD("56/83/295683.jpg"), "16 Artikel", [], "02530001"),
];

/** The shop's own pictures of its tools and pages (media/wysiwyg). */
export const PICS = {
  directcutTile: `${M}/wysiwyg/1_Tools_Banner_DE_1.jpg`,
  oringExpertTile: `${M}/wysiwyg/2_Tools_Banner_DE_1.jpg`,
  quickorderTile: `${M}/wysiwyg/3_Tools_Banner_DE_1.jpg`,
  directcutShot: `${M}/wysiwyg/DirectCUT/CUT1_EN.PNG`,
  directcutShot2: `${M}/wysiwyg/DirectCUT/CUT2_EN.PNG`,
  directcutShot3: `${M}/wysiwyg/DirectCUT/CUT3_EN.PNG`,
  machine: `${M}/wysiwyg/KT_Machine.PNG`,
  directup1: `${M}/wysiwyg/DirectUP_Img1_1.png`,
  directup2: `${M}/wysiwyg/DirectUP_Img2_1.png`,
  filters: `${M}/wysiwyg/Product_Filters_DE_1.PNG`,
  brochure: `${M}/wysiwyg/APSOparts_Sales_Brochure_DE-bilder-0.jpg`,
  aboutHeader: `${M}/wysiwyg/DE_AboutUs_Header_1920x600px_1.jpg`,
  oringGuide: `${M}/wysiwyg/1920X600_2.jpg`,
  evolast: `${M}/wysiwyg/BannerEvolast_DE.jpg`,
  quotes: ["Agazzi", "Kaufmann", "Nordfels", "Renex", "RGM"].map((n) => `${M}/wysiwyg/Quotes_DE_${n}.jpg`),
};

/** The sales brochure, in the six languages the tutorials page offers it (HubSpot files of the shop). */
export const BROCHURES: Card[] = [
  ["Deutsch", "DE"], ["Englisch", "en"], ["Französisch", "FR"], ["Italienisch", "IT"], ["Niederländisch", "NL"], ["Polnisch", "PL"],
].map(([name, c]) => mk("product", name, `https://campaigns.apsoparts.com/hubfs/APSOparts_Sales_Brochure_${c}.pdf`, "", "PDF"));

/** A product page's downloads (HITEC® O-Ring DW EPDM 70.503-00: its "Downloads" list). */
export const DOWNLOADS: Card[] = [
  mk("product", "A+P Technical Data Sheet EPDM 70.503-00", `${M}/downloads/asset//std.lang.all/c_/dw/EPDM_70_503-00_HITEC_DW.pdf`, "", "PDF · Datenblatt"),
  mk("product", "APSOseal Performance Compound Table", `${M}/downloads/asset//std.lang.all/e_/en/APSOseal%20Performance%20Compound%20Table_EN.pdf`, "", "PDF · Tabelle"),
  mk("product", "Broschüre APSOseal® O-Ringe", `${M}/downloads/asset//std.lang.all/s_/de/APSOseal%20O-Rings_DE.pdf`, "", "PDF · Broschüre"),
  mk("product", "O-Ringe Technische Grundlagen", `${M}/downloads/asset//std.lang.all/e_/fr/O-Ring%20Basic%20Catalogue_DE_FR.pdf`, "", "PDF · Katalog"),
];

/** The O-ring materials as the O-Ring selection guide's German table and "Kurzantwort" say them (word for word). */
export type Mat = { key: string; props: string[]; needs: string[]; apps: string[]; alt: string[]; short: string };
export const MATS: Mat[] = [
  { key: "NBR", props: ["Öl- und kraftstoffbeständig", "Kostengünstig", "Gute mechanische Festigkeit"], needs: ["Öle und Kraftstoffe", "Hydraulik"],
    apps: ["Hydraulik", "Pneumatik", "Automobilindustrie", "MRO"], alt: ["HNBR: höhere Wärme- und Verschleissbeständigkeit", "FKM: hohe Temperaturen und Chemikalien"],
    short: "wird häufig für Standardanwendungen mit Öl und Kraftstoff eingesetzt." },
  { key: "FKM", props: ["Hohe Wärmebeständigkeit", "Hohe Chemikalienbeständigkeit", "Öl- und kraftstoffbeständig"], needs: ["Hohe Temperaturen", "Chemische Belastung"],
    apps: ["Chemische Industrie", "Automobilindustrie", "Öl und Gas"], alt: ["FFKM: extreme Bedingungen", "HNBR: kostengünstigere Option"],
    short: "wird häufig für höhere Temperaturen und eine breitere chemische Beständigkeit empfohlen." },
  { key: "EPDM", props: ["Wasser- und dampfbeständig", "Witterungs- und ozonbeständig", "Geringe Öl-/Kraftstoffbeständigkeit"], needs: ["Wasser und Dampf", "Witterung und Ozon"],
    apps: ["Trinkwasser", "Lebensmittel und Getränke", "HLK"], alt: ["VMQ: breiterer Temperaturbereich", "NBR/HNBR/FKM: Öle und Kraftstoffe"],
    short: "geeignet für Wasser, Dampf, Witterung und Ozon." },
  { key: "VMQ", props: ["Breiter Temperaturbereich", "Flexibilität bei niedrigen Temperaturen", "Optionen für Lebensmittelanwendungen"], needs: ["Sehr niedrige Temperaturen", "Flexibilität für Lebensmittelanwendungen"],
    apps: ["Lebensmittel und Getränke", "Medizintechnik", "Elektronik"], alt: ["FKM: Öle und Chemikalien", "EPDM: Wasser und Dampf"],
    short: "geeignet für hohe Flexibilität bei sehr niedrigen Temperaturen oder passende lebensmittelkonforme Optionen." },
  { key: "HNBR", props: ["Höhere Wärmebeständigkeit", "Ozon- und UV-beständig", "Hohe mechanische Festigkeit"], needs: ["Höhere Temperaturen", "Mechanische Belastung"],
    apps: ["Fahrzeugklimatisierung", "Öl und Gas", "Hochleistungs-Hydraulik"], alt: ["FKM: höhere Temperaturen und Chemikalien"],
    short: "eine Weiterentwicklung gegenüber NBR, wenn eine höhere Beständigkeit gegen Wärme, Ozon und mechanische Belastung erforderlich ist." },
  { key: "PTFE", props: ["Geringe Reibung", "Ausgezeichnete Chemikalienbeständigkeit", "Breiter Temperaturbereich"], needs: ["Aggressive Chemikalien", "Statische Abdichtung"],
    apps: ["Chemische Dichtungen", "Ventile", "Lebensmittel und Pharma"], alt: ["Nut und Bewegung prüfen"],
    short: "verhält sich als nicht elastischer Dichtungswerkstoff - Nut und Bewegung prüfen." },
  { key: "FFKM", props: ["Extreme Chemikalienbeständigkeit", "Extreme Wärmebeständigkeit"], needs: ["Hohe Temperaturen", "Aggressive Chemikalien"],
    apps: ["Chemische Industrie", "Öl und Gas", "Pharma"], alt: ["FEP-O-Seal: ausgewählte statische Dichtungen"],
    short: "für extreme chemische und thermische Bedingungen." },
];
export const mat = (k: string) => MATS.find((m) => m.key === k)!;
/** The guide's own warning under its material table. */
export const MAT_NOTE = "Temperaturbereiche, chemische Beständigkeit, Zulassungen und Dokumentationen unterscheiden sich je nach Compound und Artikel. Prüfen Sie vor dem Wechsel von einem Werkstoff oder einer Produktlinie zu einer anderen immer das produktspezifische Datenblatt.";

/** The tutorials page's videos (anchors on /support/tutorials). */
export const TUTORIALS: { title: string; text: string; anchor: string; icon: string }[] = [
  { title: "Mit dem APSOparts® Online-Shop starten", text: "Die wichtigsten Funktionen und Vorteile des Webshops.", anchor: "#gettoknow", icon: "play" },
  { title: "Produkte suchen, filtern und bestellen", text: "Sich im Shop zurechtfinden, Produktinformationen finden, die Bestellung abschliessen.", anchor: "#navigation", icon: "filter" },
  { title: "DirectCUT Produkt-Konfigurator", text: "Was der Konfigurator kann, für welche Produkte, mit Tipps und Tricks.", anchor: "#directcut", icon: "cut" },
  { title: "O-RING EXPERT Produktfinder", text: "Den passenden O-Ring für Ihre Anwendung finden.", anchor: "#oringexpert", icon: "ring" },
  { title: "DirectUP: Bestellungen hochladen", text: "Grössere Produktlisten schnell hochladen und bestellen.", anchor: "#directup", icon: "upload" },
  { title: "Die Smart Search Bar", text: "Nach Produkttyp, Material, Abmessungen oder Anwendung suchen - auch ohne Artikelnummer.", anchor: "#searchbar", icon: "search" },
  { title: "Die chemische Beständigkeitstabelle", text: "Die Beständigkeit von Werkstoffen gegen Chemikalien prüfen.", anchor: "#chemicalguide", icon: "flask" },
];
