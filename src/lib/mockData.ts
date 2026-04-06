// ── Mock data for APSO Marketing Hub ──
// All data is realistic for APSOparts (industrial B2B sealings & plastics distributor)
// Focus: sealing solutions, engineered plastics, rubber components, gaskets, o-rings

export const kpiData = {
  organicTraffic: { value: null as number | null, change: 0, period: "Awaiting GA4 connection" },
  keywordRankings: { value: null as number | null, change: 0, period: "Awaiting GSC connection" },
  contentPieces: { value: 3, change: 0, period: "drafts in pipeline" },
  avgPosition: { value: null as number | null, change: 0, period: "Awaiting GSC connection" },
  clickThroughRate: { value: null as number | null, change: 0, period: "Awaiting GA4 connection" },
  pipelineItems: { value: 12, change: 0, period: "planned this month" },
  draftsPending: { value: 9, change: 0, period: "awaiting approval" },
  knowledgeDocs: { value: 8, change: 0, period: "in knowledge base" },
};

export const trafficChartData = [
  { month: "Oct", organic: 0, paid: 0, direct: 0 },
  { month: "Nov", organic: 0, paid: 0, direct: 0 },
  { month: "Dec", organic: 0, paid: 0, direct: 0 },
  { month: "Jan", organic: 0, paid: 0, direct: 0 },
  { month: "Feb", organic: 0, paid: 0, direct: 0 },
  { month: "Mar", organic: 0, paid: 0, direct: 0 },
];

export const contentPipelineData = [
  { status: "Idea", count: 4, color: "#94a3b8" },
  { status: "Brief", count: 3, color: "#8b5cf6" },
  { status: "Draft", count: 3, color: "#f59e0b" },
  { status: "In Review", count: 1, color: "#3b82f6" },
  { status: "Approved", count: 1, color: "#10b981" },
];

export const activityFeed = [
  { id: 1, type: "content" as const, message: "LinkedIn draft generated: 'FKM vs FFKM: choosing your o-ring for chemical resistance'", time: "8 min ago", status: "pending_review" as const },
  { id: 2, type: "content" as const, message: "LinkedIn draft generated: 'PEEK in aerospace: the high-performance plastic explained'", time: "22 min ago", status: "pending_review" as const },
  { id: 3, type: "content" as const, message: "LinkedIn draft generated: 'O-rings for food & beverage processing'", time: "45 min ago", status: "pending_review" as const },
  { id: 4, type: "content" as const, message: "Newsletter draft generated: 'Q2 2026 — New FFKM range, expanded PEEK catalog & spring webinar'", time: "1 hour ago", status: "pending_review" as const },
  { id: 5, type: "content" as const, message: "Newsletter draft generated: '[New Guide] How to choose the right o-ring material in 5 questions'", time: "1 hour ago", status: "pending_review" as const },
  { id: 6, type: "content" as const, message: "Newsletter draft generated: 'PEEK vs POM-C — which one fits your next project?'", time: "2 hours ago", status: "pending_review" as const },
  { id: 7, type: "content" as const, message: "Blog draft generated: 'O-Ring Material Selection Guide: FKM, FFKM & Silicone for Demanding Applications'", time: "3 hours ago", status: "pending_review" as const },
  { id: 8, type: "content" as const, message: "Blog draft generated: 'PEEK vs POM-C: Engineering Plastics Comparison for Precision Components'", time: "3 hours ago", status: "pending_review" as const },
  { id: 9, type: "content" as const, message: "Blog draft generated: '5 Common O-Ring Failure Modes (and How to Prevent Each One)'", time: "4 hours ago", status: "pending_review" as const },
  { id: 10, type: "system" as const, message: "Content pipeline run complete: 9 drafts generated across LinkedIn, Newsletter and Blog", time: "4 hours ago", status: "info" as const },
  { id: 11, type: "system" as const, message: "Knowledge base updated: 'Rubber & Elastomer Material Data Sheets' refreshed", time: "6 hours ago", status: "info" as const },
];

export const seoKeywords = [
  { keyword: "o-ring material selection guide", volume: 2400, position: 0, change: 0, cpc: 4.20, difficulty: 42, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "PEEK machined parts manufacturer", volume: 1800, position: 0, change: 0, cpc: 5.80, difficulty: 55, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "POM-C acetal copolymer applications", volume: 980, position: 0, change: 0, cpc: 4.10, difficulty: 38, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "FKM o-rings high temperature", volume: 3200, position: 0, change: 0, cpc: 4.90, difficulty: 51, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "custom o-rings food grade EPDM", volume: 1400, position: 0, change: 0, cpc: 3.50, difficulty: 44, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "PEEK vs POM-C comparison", volume: 2100, position: 0, change: 0, cpc: 4.70, difficulty: 51, url: "", cannibalization: false, source: "Editorial" as const },
  { keyword: "FFKM o-rings chemical resistance", volume: 890, position: 0, change: 0, cpc: 6.20, difficulty: 47, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "engineered plastics PEEK applications", volume: 1650, position: 0, change: 0, cpc: 5.00, difficulty: 67, url: "", cannibalization: false, source: "Editorial" as const },
  { keyword: "o-ring failure analysis guide", volume: 1200, position: 0, change: 0, cpc: 4.40, difficulty: 35, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "POM-C machining tolerances", volume: 760, position: 0, change: 0, cpc: 3.80, difficulty: 40, url: "", cannibalization: false, source: "Content Gap" as const },
];

export const contentCalendarItems = [
  { id: "cal-1", title: "O-Ring Material Selection Guide — FKM, FFKM & Silicone", date: "2026-04-07", channel: "Blog" as const, status: "draft" as const, assignee: "AI + Miriam", priority: "high" as const },
  { id: "cal-2", title: "LinkedIn: New PEEK Machined Components Range", date: "2026-04-08", channel: "LinkedIn" as const, status: "approved" as const, assignee: "Aleksandra", priority: "high" as const },
  { id: "cal-3", title: "POM-C Acetal Copolymer — Applications & Tolerances", date: "2026-04-10", channel: "Blog" as const, status: "idea" as const, assignee: "Unassigned", priority: "medium" as const },
  { id: "cal-4", title: "Newsletter: O-Rings & Plastics Q2 Update", date: "2026-04-11", channel: "Newsletter" as const, status: "in_review" as const, assignee: "Miriam", priority: "medium" as const },
  { id: "cal-5", title: "LinkedIn: Food-Grade EPDM O-Rings Case Study", date: "2026-04-14", channel: "LinkedIn" as const, status: "idea" as const, assignee: "Unassigned", priority: "low" as const },
  { id: "cal-6", title: "PEEK vs POM-C — Engineering Plastics Comparison", date: "2026-04-15", channel: "Blog" as const, status: "brief" as const, assignee: "AI", priority: "high" as const },
  { id: "cal-7", title: "LinkedIn: O-Ring Failure Modes & Prevention", date: "2026-04-16", channel: "LinkedIn" as const, status: "draft" as const, assignee: "Aleksandra", priority: "medium" as const },
  { id: "cal-8", title: "PEEK Aerospace Sealing Applications Guide", date: "2026-04-17", channel: "Newsletter" as const, status: "approved" as const, assignee: "Miriam", priority: "high" as const },
  { id: "cal-9", title: "FFKM O-Rings for Chemical Resistance", date: "2026-04-21", channel: "Blog" as const, status: "idea" as const, assignee: "Unassigned", priority: "medium" as const },
  { id: "cal-10", title: "LinkedIn: Sustainability in PEEK Manufacturing", date: "2026-04-22", channel: "LinkedIn" as const, status: "brief" as const, assignee: "AI", priority: "low" as const },
  { id: "cal-11", title: "O-Ring Sizing Guide — Standard vs Custom", date: "2026-04-24", channel: "Blog" as const, status: "draft" as const, assignee: "AI + Miriam", priority: "high" as const },
  { id: "cal-12", title: "Newsletter: POM-C Machining Best Practices", date: "2026-04-28", channel: "Newsletter" as const, status: "idea" as const, assignee: "Unassigned", priority: "low" as const },
];

export const studioContentBriefs = [
  {
    id: "brief-1",
    title: "O-Ring Material Selection Guide — FKM, FFKM & Silicone",
    keyword: "o-ring material selection guide",
    reasoning: "Target keyword 'o-ring material selection guide' has estimated volume of 2,400/mo with moderate difficulty (42/100). APSOparts has no content targeting this term. High commercial intent (CPC $4.20). Recommended approach: technical guide comparing FKM, FFKM, and silicone o-ring materials across temperature, chemical resistance, and compression set criteria.",
    status: "pending_approval" as const,
    score: 87,
    wordCount: 1800,
    channel: "Blog" as const,
    createdAt: "2026-04-03T10:30:00Z",
  },
  {
    id: "brief-2",
    title: "PEEK vs POM-C — Engineering Plastics Comparison for Precision Parts",
    keyword: "PEEK vs POM-C comparison",
    reasoning: "Content gap analysis: competitors rank for this engineered plastics comparison (est. 2,100 monthly volume). APSOparts has no comparison content for these two key engineering plastics. High commercial intent (CPC $4.70). Strategic for plastics product line. Recommended format: detailed comparison covering mechanical properties, chemical resistance, machinability, and cost.",
    status: "approved" as const,
    score: 92,
    wordCount: 2200,
    channel: "Blog" as const,
    createdAt: "2026-04-02T14:15:00Z",
  },
  {
    id: "brief-3",
    title: "PEEK Machined Parts for Aerospace Sealing Applications",
    keyword: "PEEK aerospace sealing",
    reasoning: "Editorial calendar injection — strategic topic for PEEK product line expansion. PEEK is a key high-performance plastic in APSOparts portfolio. Aerospace is a high-value vertical. Opportunity to position APSOparts as technical authority in PEEK machined components for demanding sealing environments.",
    status: "generating" as const,
    score: 78,
    wordCount: 1500,
    channel: "Blog" as const,
    createdAt: "2026-04-04T08:00:00Z",
  },
];

/* ── Content proposals (per channel) for Content Studio ── */

export type ContentChannel = "LinkedIn" | "Newsletter" | "Blog";

export type ProposalTheme =
  | "oring-fkm"
  | "oring-food"
  | "oring-failure"
  | "oring-guide"
  | "peek-aerospace"
  | "peek-pomc"
  | "pomc"
  | "pharma"
  | "newsletter-q2"
  | "maintenance";

export interface ContentProposal {
  id: string;
  channel: ContentChannel;
  title: string;
  topic: string;
  text: string;
  reasoning: string;
  qualityScore: number;
  theme: ProposalTheme;
}

export const contentProposals: ContentProposal[] = [
  /* ── LinkedIn (5) ── */
  {
    id: "li-1",
    channel: "LinkedIn",
    title: "FKM vs FFKM: choosing your o-ring for chemical resistance",
    topic: "FKM vs FFKM o-rings",
    text: "Choosing between FKM and FFKM o-rings? Here's what matters for chemical resistance:\n\n✅ FKM: Excellent for fuels, oils & most acids — service up to +200°C\n✅ FFKM: The ultimate chemical resistance — handles aggressive media up to +325°C\n\nThe right choice depends on your media, temperature, and budget. Browse our FKM and FFKM o-ring catalog or request samples to test on your own bench.\n\n#ORings #Sealing #FKM #FFKM #APSOparts",
    reasoning: "High-engagement format (comparison + emoji) for technical audience. Targets engineers searching FKM vs FFKM. Aligns with Q2 sealing focus.",
    qualityScore: 91,
    theme: "oring-fkm",
  },
  {
    id: "li-2",
    channel: "LinkedIn",
    title: "PEEK in aerospace: the high-performance plastic explained",
    topic: "PEEK aerospace applications",
    text: "Why does aerospace love PEEK?\n\n🚀 Operating temperature up to +260°C\n🚀 Self-extinguishing (V-0 rating)\n🚀 Outstanding chemical & wear resistance\n🚀 Lightweight alternative to metals\n\nFrom bushings to seal back-up rings, PEEK is replacing metal components across modern aircraft. Explore our PEEK rod, sheet and semi-finished range at APSOparts.\n\n#PEEK #Aerospace #EngineeredPlastics #APSOparts",
    reasoning: "Industry-vertical content targeting aerospace engineers. PEEK is key product line. Format leverages curiosity hook.",
    qualityScore: 88,
    theme: "peek-aerospace",
  },
  {
    id: "li-3",
    channel: "LinkedIn",
    title: "POM-C precision parts: when tolerances matter",
    topic: "POM-C machining tolerances",
    text: "POM-C (acetal copolymer) is the designer's choice when you need:\n\n⚙️ Tight tolerances (±0.05mm achievable)\n⚙️ Excellent dimensional stability\n⚙️ Low friction & wear\n⚙️ Food-contact compliance available\n\nFrom gears to bushings to precision housings, POM-C delivers consistent performance. Available in rod, sheet and semi-finished shapes at APSOparts.\n\n#POMC #EngineeringPlastics #PrecisionParts #APSOparts",
    reasoning: "Educational content about a flagship plastic. Targets procurement and design engineers. Lists concrete benefits.",
    qualityScore: 85,
    theme: "pomc",
  },
  {
    id: "li-4",
    channel: "LinkedIn",
    title: "5 signs your o-rings need replacing",
    topic: "o-ring failure analysis",
    text: "Don't wait for a leak. Watch for these warning signs:\n\n1️⃣ Surface cracking or hardening\n2️⃣ Compression set (loss of elasticity)\n3️⃣ Swelling or shrinkage\n4️⃣ Discoloration\n5️⃣ Sticky or tacky surface\n\nPredictive replacement saves downtime. Browse APSOparts' o-ring catalog to find your replacement in FKM, FFKM, EPDM, NBR or Silicone.\n\n#ORings #Maintenance #Sealing #APSOparts",
    reasoning: "Listicle format performs well on LinkedIn. Maintenance angle reaches operations managers. Strong CTA.",
    qualityScore: 89,
    theme: "oring-failure",
  },
  {
    id: "li-5",
    channel: "LinkedIn",
    title: "O-rings for food & beverage processing",
    topic: "food-grade EPDM o-rings",
    text: "Food and beverage processing demands more than ordinary sealing.\n\n🍽️ FDA-compliant materials\n🍽️ EPDM, silicone & FKM food-grade options\n🍽️ Steam & CIP resistant\n🍽️ Sizes & profiles available\n\nAPSOparts supplies certified o-rings to food processing leaders across Europe. Your application — our solution.\n\n#FoodSafety #ORings #EPDM #APSOparts",
    reasoning: "Vertical-specific (F&B) targets a high-value industry. Compliance angle resonates with regulated buyers.",
    qualityScore: 86,
    theme: "oring-food",
  },

  /* ── Newsletter (3) — full email format ── */
  {
    id: "nl-1",
    channel: "Newsletter",
    title: "Q2 2026 — New FFKM range, expanded PEEK catalog & spring webinar",
    topic: "Q2 product newsletter",
    text: "📬 Subject: Q2 at APSOparts — what's new in sealings & plastics\n\nHi {first_name},\n\nSpring is here and so is a fresh batch of products in our catalog to help you build better, seal tighter, and ship faster. This quarter we've focused on the materials and stock depth our customers ask about most: high-performance elastomers for aggressive chemistries, an expanded PEEK range for regulated industries, and POM-C inventory deep enough that you'll never wait six weeks for a standard rod again.\n\n— What's new this quarter —\n\n🔹 FFKM o-ring range\nUltra-high chemical resistance for the most demanding aggressive media — concentrated acids, strong bases, ketones, amines, hot steam, and process chemistries that destroy standard FKM in weeks. Our new FFKM range covers the full ISO 3601 size catalog, with USP Class VI and EU 1935/2004 compliant grades available for regulated industries. Standard sizes shipping from stock in 48h, custom geometries on a 2-week lead time with full lot traceability.\n\n🔹 Expanded PEEK catalog\n40+ new PEEK rod and sheet references for aerospace, semiconductor and medical applications, including unfilled, 30% glass-filled, 30% carbon-filled, and bearing-grade HPV variants. Every batch ships with EN 10204 3.1 material certification and full traceability for AS9100 supply chains. Rod diameters from Ø6 to Ø200 mm, sheet thicknesses from 1 to 80 mm.\n\n🔹 POM-C stock expanded\nRod (Ø6 to Ø300 mm) and sheet (1 to 50 mm) now in stock across all standard dimensions. No more 6-week lead times, no more last-minute redesigns to use what's available. Food-contact compliant grades (EU 1935/2004) carried alongside standard natural and black, with custom colors on request for OEM branding.\n\n— Spring technical webinar —\nJoin our materials team on May 14th for a live 45-minute session on \"Specifying elastomers for CIP/SIP environments\" — practical guidance, real failure photos, and a live Q&A with our application engineers. Free to attend, recording sent to all registrants.\n\n— Free technical resources —\nNew datasheets, chemical compatibility tables and material guides — all downloadable from the APSOparts product pages without a form wall. Print them, share them with your team, keep them on the shop floor.\n→ Browse the catalog\n\n— Request samples —\nTest materials on your own bench before committing. Free samples for qualified projects, shipped within 48h to anywhere in Europe with full datasheets included.\n→ Request samples\n\nTo your next perfect seal,\nThe APSOparts Team",
    reasoning: "Quarterly digest format with 3 product sections + webinar + consultation CTA. Drives both immediate orders and lead capture.",
    qualityScore: 90,
    theme: "newsletter-q2",
  },
  {
    id: "nl-2",
    channel: "Newsletter",
    title: "[New Guide] How to choose the right o-ring material in 5 questions",
    topic: "o-ring material guide",
    text: "📬 Subject: The 5 questions that determine your o-ring material\n\nHi {first_name},\n\nA great design, the wrong elastomer, and a seal that fails after 3 months in service — we see it all the time. The right material is rarely the most expensive; it's the one that matches your application. Over-specifying burns budget on every part you ship; under-specifying burns reputation when the line goes down on a Friday night. The good news: 90% of selection mistakes can be avoided by answering five questions before you commit.\n\nWe've put together a free guide that walks through the 5 questions to answer before specifying — with a printable decision flowchart and a chemical/temperature matrix on the back page.\n\n1️⃣ What's the operating temperature range?\nNot just the steady-state value — the peaks, the cold starts, the CIP cycles. Most failures we troubleshoot in the field come from underestimating the high or low extremes.\n\n2️⃣ What media will the seal contact?\nList every fluid: process media, cleaning agents, lubricants, and any unintended contaminants. Compatibility is binary — one wrong fluid is enough to swell or dissolve the wrong compound.\n\n3️⃣ Static or dynamic application?\nDynamic seals demand harder compounds, lower friction, and more attention to surface finish. Static seals tolerate softer materials but punish poor groove design.\n\n4️⃣ What pressure & duty cycle?\nHigh pressure plus large clearance equals extrusion. High duty cycles plus marginal temperature equals compression set. Both are predictable if you know the numbers.\n\n5️⃣ Any compliance requirements (FDA, USP, EU 1935)?\nRegulated industries need documentation as much as performance. Ask for the certificates up front — retrofitting compliance is painful and expensive.\n\nThe guide includes a temperature/chemical compatibility matrix for FKM, FFKM, EPDM, NBR, and Silicone — printable for your reference and small enough to slip into a project folder.\n\n→ Download the free guide (PDF)\n→ Browse the APSOparts o-ring catalog\n→ Request free samples to test on your bench\n\nUntil next time,\nThe APSOparts Team",
    reasoning: "Lead magnet format with downloadable PDF. The 5-question framework is memorable and shareable. Two CTAs: download + consultation.",
    qualityScore: 92,
    theme: "oring-guide",
  },
  {
    id: "nl-3",
    channel: "Newsletter",
    title: "PEEK vs POM-C — which one fits your next project? (decision tree inside)",
    topic: "PEEK vs POM-C comparison",
    text: "📬 Subject: PEEK or POM-C? Here's how to decide in 30 seconds\n\nHi {first_name},\n\n\"Should I spec PEEK or POM-C?\" The honest answer is — it depends on three things. Use the decision tree below before your next BOM. We see customers spec PEEK out of caution when POM-C would carry the load at one-tenth the cost, and we see the opposite mistake too: POM-C parts melting, swelling, or cracking in environments that needed PEEK from day one. Both materials are excellent — but they're excellent at different things, and choosing well saves real money.\n\n— The 30-second decision tree —\n\n✅ Need >120 °C continuous service? → PEEK\n✅ Aggressive chemicals or steam? → PEEK\n✅ Aerospace / medical / semicon certifications? → PEEK\n✅ Ultra-low outgassing for vacuum or space? → PEEK\n✅ High mechanical loads at elevated temperature? → PEEK\n\n✅ Room-temperature mechanical part? → POM-C\n✅ Tight tolerances at lower cost? → POM-C\n✅ Food-contact compliance only? → POM-C\n✅ High-volume gears, bushings, slide rails? → POM-C\n✅ Easy machining with fast cycle times? → POM-C\n\n— The cost reality —\nPEEK is roughly 8-12× the material cost of POM-C, and machining PEEK takes more attention to tooling and feed rates. When the application doesn't justify it, POM-C delivers excellent performance at a fraction of the price — and your machinist will thank you. We've helped customers cut a single guide-bushing cost from €34 to €4 by switching from PEEK to POM-C, with zero impact on lifespan in a room-temperature application.\n\n— A practical example —\nA conveyor manufacturer was speccing PEEK for chain guides because \"the line runs hot.\" When we measured the actual contact temperature, it was 65 °C — well within POM-C's comfort zone. The switch saved €18,000 a year and the parts now last longer because POM-C's lower friction reduces wear at that temperature.\n\n— Free side-by-side comparison sheet —\nTemperature, chemical resistance, mechanical properties, machinability, and indicative pricing — all on one page, designed to live next to your CAD station.\n→ Download the comparison sheet\n\n— Order samples —\nTest before you spec. Free 50×50 mm POM-C and PEEK sample plates for qualified projects, shipped in 48h with full datasheets.\n→ Request samples\n→ Browse the APSOparts plastics catalog\n\nTo your next great design,\nThe APSOparts Team",
    reasoning: "Decision-tree format reduces cognitive load. Free sample CTA generates qualified leads. Honest cost talk builds trust.",
    qualityScore: 91,
    theme: "peek-pomc",
  },

  /* ── Blog (3) — full article format ── */
  {
    id: "bl-1",
    channel: "Blog",
    title: "O-Ring Material Selection Guide: FKM, FFKM & Silicone for Demanding Applications",
    topic: "o-ring material selection",
    text: "📰 Reading time: 8 min · Audience: design & maintenance professionals\n\nSelecting the right o-ring material for high-temperature, chemically aggressive environments is one of the most consequential decisions in mechanical design. Get it wrong, and a $0.50 elastomer ring can shut down a $500k production line.\n\n— Why material selection matters more than you think —\n\nAt sustained temperatures above 200 °C, standard elastomers begin to lose their mechanical properties. Compression set increases, chemical resistance drops, and the seal that worked perfectly in lab testing fails in the field within weeks. The cost of premature failure far outweighs the marginal cost of upgrading to a higher-performance compound.\n\n— FKM (Fluoroelastomer) — the workhorse —\n\nFKM remains the most popular high-performance choice for continuous service up to 200 °C. It offers excellent resistance to oils, fuels, most acids, and aliphatic hydrocarbons. Standard FKM is the right choice for 80% of demanding applications where temperature stays below 200 °C.\n\n• Service temp: -20 to +200 °C (some grades to +230 °C)\n• Cost: medium-high\n• Best for: automotive, fuel systems, hydraulics, chemical processing\n\n— FFKM (Perfluoroelastomer) — when failure is not an option —\n\nWhen the application demands the absolute best, FFKM extends the operating window to 320 °C while delivering near-universal chemical compatibility. Yes, it's expensive — typically 20× the cost of FKM — but for critical applications in semiconductors, pharma, and aerospace, the math works.\n\n• Service temp: -20 to +320 °C\n• Cost: very high\n• Best for: semiconductor, pharma CIP/SIP, aggressive chemicals, ultra-high-temp\n\n— Silicone — the temperature champion —\n\nSilicone deserves a mention for its unique low-temperature performance: flexibility down to -60 °C, intermittent service to +230 °C. Less chemically resistant than FKM, but unbeatable for thermal cycling and food/medical contact.\n\n— Sourcing o-rings at APSOparts —\n\nAPSOparts stocks FKM, FFKM, EPDM, NBR and Silicone o-rings in all standard ISO 3601 sizes, with custom compounds available to order. Full traceability and technical datasheets on every product page.\n\n→ Browse the APSOparts o-ring catalog\n→ Download the temperature/chemical compatibility chart\n→ Request free samples to test on your bench",
    reasoning: "Cornerstone pillar article (8-min read) targeting 'o-ring material selection guide' (2,400 vol/mo). 3 material sections + cost guidance + 2 CTAs (consultation + samples).",
    qualityScore: 94,
    theme: "oring-guide",
  },
  {
    id: "bl-2",
    channel: "Blog",
    title: "PEEK vs POM-C: Engineering Plastics Comparison for Precision Components",
    topic: "PEEK vs POM-C",
    text: "📰 Reading time: 6 min · Audience: design, procurement & maintenance\n\nWhen designing precision components, the choice between PEEK and POM-C can shift your bill of materials by 10× and your part lifespan by 5×. Both materials are excellent — but they're excellent at different things.\n\n— The headline difference —\n\nPEEK is a high-performance thermoplastic built for extreme environments. POM-C (acetal copolymer) is the workhorse plastic that delivers excellent precision and value at room temperature. Confuse them and you either over-spec (and burn budget) or under-spec (and burn the part).\n\n— Side-by-side specifications —\n\n📊 Continuous service temp\nPEEK: 260 °C  |  POM-C: 100 °C\n\n📊 Tensile strength (MPa)\nPEEK: 100  |  POM-C: 65\n\n📊 Chemical resistance\nPEEK: excellent (acids, bases, solvents)  |  POM-C: good (limited vs strong acids)\n\n📊 Machinability\nPEEK: good, but tool wear is real  |  POM-C: excellent — chips clean, holds tolerance\n\n📊 Cost (€/kg, indicative)\nPEEK: €90-120  |  POM-C: €8-12\n\n— When to choose PEEK —\n\n✅ Continuous service above 120 °C\n✅ Aggressive chemicals (steam, strong acids)\n✅ Aerospace, medical, semiconductor certifications required\n✅ High mechanical loads at elevated temperature\n✅ Ultra-low outgassing for vacuum applications\n\n— When to choose POM-C —\n\n✅ Room-temperature mechanical parts\n✅ Tight tolerances at lower cost\n✅ Gears, bushings, slide rails, manifolds\n✅ Food-contact compliance only (not pharma)\n✅ High-volume production where cost matters\n\n— A common scenario —\n\nUsing PEEK for guide bushings at €34 per part — when the application is room-temperature and chemical-free — often hides an opportunity. Switching to POM-C for the same part can drop cost to €4 with identical lifespan. Across one product line that's easily €10-20k per year saved.\n\n— Sourcing at APSOparts —\n\nAPSOparts stocks both PEEK and POM-C in rod (Ø6–300 mm) and sheet (1–50 mm). Standard references ship in 48h; custom dimensions on request.\n\n→ Browse PEEK products\n→ Browse POM-C products\n→ Request free PEEK and POM-C samples",
    reasoning: "High-intent comparison (2,100 vol/mo). Detailed spec table + customer example with savings number. Two free CTAs.",
    qualityScore: 93,
    theme: "peek-pomc",
  },
  {
    id: "bl-3",
    channel: "Blog",
    title: "5 Common O-Ring Failure Modes (and How to Prevent Each One)",
    topic: "o-ring failure analysis",
    text: "📰 Reading time: 7 min · Audience: maintenance, operations, design\n\nO-rings are deceptively simple — until one fails on a Friday night and shuts down your line until Monday. The good news: most failures are predictable, visible, and preventable.\n\nHere are the 5 failure modes most commonly seen in the field, along with the root causes and the fix.\n\n— 1. Compression set —\n\nWhat it looks like: the o-ring is permanently deformed, no longer round in cross-section.\nRoot cause: wrong material, over-compression, or service temperature too high.\nThe fix: switch to a higher-temperature elastomer (FKM or FFKM) and verify groove design.\n\n— 2. Chemical attack —\n\nWhat it looks like: swelling, softening, or hardening; sometimes color change.\nRoot cause: incompatible elastomer for the media in contact.\nThe fix: check the chemical compatibility chart for your media. Often this means upgrading from NBR to FKM, or FKM to FFKM.\n\n— 3. Thermal degradation —\n\nWhat it looks like: surface cracking, brittleness, glazed appearance.\nRoot cause: service temperature exceeds the elastomer's rated limit.\nThe fix: either reduce operating temperature (rarely possible) or upgrade material.\n\n— 4. Extrusion —\n\nWhat it looks like: nibbled or torn edges where the ring squeezed into a clearance gap.\nRoot cause: too much pressure, too soft a material, or an oversized clearance.\nThe fix: add a back-up ring (PEEK or PTFE), increase elastomer hardness, or reduce gap.\n\n— 5. Installation damage —\n\nWhat it looks like: cuts, scratches, or torn sections.\nRoot cause: sharp edges in the housing, poor lubrication, or rough handling.\nThe fix: deburr edges, use proper assembly lube, train installers.\n\n— Prevention starts with the right material —\n\nMost of these failures come down to one thing: specifying the right elastomer for the service conditions. Using the APSOparts chemical compatibility chart and material datasheets during design catches 80% of issues before they happen.\n\n→ Download the failure-mode visual reference card\n→ Download the chemical compatibility chart\n→ Browse the APSOparts o-ring catalog",
    reasoning: "Listicle structure (5 modes) is highly engaging and shareable. Each mode has visual cues + fix. Strong CTAs for engagement.",
    qualityScore: 91,
    theme: "oring-failure",
  },
];

export const knowledgeBaseDocuments = [
  { id: "kb-1", name: "APSOparts Brand Guidelines v3.2", type: "Brand" as const, size: "2.4 MB", lastUpdated: "2026-03-15", version: "3.2", shared: true },
  { id: "kb-2", name: "Product Catalog — Sealing Solutions", type: "Product" as const, size: "8.1 MB", lastUpdated: "2026-03-28", version: "2026-Q1", shared: true },
  { id: "kb-3", name: "Product Catalog — Engineered Plastics", type: "Product" as const, size: "5.6 MB", lastUpdated: "2026-03-25", version: "2026-Q1", shared: true },
  { id: "kb-4", name: "Tone of Voice Document", type: "Brand" as const, size: "340 KB", lastUpdated: "2026-02-10", version: "2.1", shared: true },
  { id: "kb-5", name: "Rubber & Elastomer Material Data Sheets", type: "Product" as const, size: "3.8 MB", lastUpdated: "2026-03-20", version: "2026-Q1", shared: true },
  { id: "kb-6", name: "Technical Glossary — Sealings & Plastics (EN/DE/FR)", type: "Reference" as const, size: "520 KB", lastUpdated: "2026-01-30", version: "4.1", shared: true },
  { id: "kb-7", name: "SEO Keyword Master List", type: "SEO" as const, size: "180 KB", lastUpdated: "2026-04-01", version: "2026-04", shared: true },
  { id: "kb-8", name: "Industry Application Guides — Food, Pharma, Automotive", type: "Product" as const, size: "3.2 MB", lastUpdated: "2026-02-28", version: "1.3", shared: true },
];

export const auditLogs = [
  { id: "log-1", timestamp: "2026-04-04T10:30:22Z", action: "Content Generated" as const, user: "System (AI)", details: "Generated blog draft: 'O-Ring Material Selection for High-Temp Sealing' | Keyword: o-ring high temperature sealing | Model: claude-opus-4-6 | Tokens: 4,230", prompt: "Write a technical blog post about o-ring material selection for high-temperature industrial sealing applications. Compare FKM, FFKM, and silicone materials. Target keyword: 'o-ring high temperature sealing'. Tone: professional, technical. Brand voice: authoritative B2B sealings & plastics specialist...", input: "KB docs: Product Catalog Sealing, Rubber & Elastomer Data Sheets, Technical Glossary, Brand Guidelines v3.2", output: "# O-Ring Material Selection for High-Temperature Sealing Applications\n\nWhen operating temperatures exceed 200°C, standard elastomer o-rings begin to lose their sealing integrity..." },
  { id: "log-2", timestamp: "2026-04-04T09:15:00Z", action: "Topic Approved" as const, user: "Miriam", details: "Approved content brief: 'PTFE vs FKM: Choosing the Right Sealing Material' — Score: 92/100", prompt: "", input: "", output: "" },
  { id: "log-3", timestamp: "2026-04-04T08:00:00Z", action: "Pipeline Run" as const, user: "System", details: "Content pipeline executed. Analyzed editorial calendar + content gaps. Generated 3 content briefs focused on sealings and engineered plastics.", prompt: "", input: "Editorial calendar: 12 planned topics | Content gaps: 10 target keywords | Knowledge base: 8 documents", output: "3 briefs generated: O-ring high temp, PTFE vs FKM, PEEK vs POM. 0 cannibalization risks. 0 duplicate topics in 6-month window." },
  { id: "log-4", timestamp: "2026-04-03T16:45:00Z", action: "Content Rejected" as const, user: "Aleksandra", details: "Requested changes on draft: 'Silicone Rubber in Medical Device Sealing' — Reason: needs more technical depth on FDA compliance requirements", prompt: "", input: "", output: "" },
  { id: "log-5", timestamp: "2026-04-03T14:20:00Z", action: "KB Updated" as const, user: "Miriam", details: "Uploaded 'Rubber & Elastomer Material Data Sheets' (3.8 MB) — covers NBR, EPDM, FKM, FFKM, silicone, and PTFE specifications", prompt: "", input: "", output: "" },
  { id: "log-6", timestamp: "2026-04-03T11:00:00Z", action: "KB Updated" as const, user: "Aleksandra", details: "Updated 'Product Catalog — Sealing Solutions' to version 2026-Q1. Added 15 new rubber gasket product entries.", prompt: "", input: "", output: "" },
  { id: "log-7", timestamp: "2026-04-02T15:30:00Z", action: "Content Generated" as const, user: "System (AI)", details: "Generated LinkedIn post: 'PTFE vs FKM comparison for chemical resistance' | Model: claude-opus-4-6 | Tokens: 890", prompt: "Write a LinkedIn post comparing PTFE and FKM sealing materials for chemical resistance applications. Tone: professional, engaging. Audience: engineers and procurement managers...", input: "KB docs: Product Catalog Sealing, Tone of Voice Document", output: "Choosing between PTFE and FKM for your critical sealing application? Here's what matters most for chemical resistance..." },
];

export const analyticsData = {
  contentPerformance: [
    { title: "O-Ring Material Selection Guide", views: 0, clicks: 0, conversions: 0, channel: "Blog" },
    { title: "O-Ring Material Selection Guide — FKM, FFKM & Silicone", views: 8420, clicks: 1180, conversions: 142, channel: "Blog" },
    { title: "PEEK vs POM-C: Engineering Plastics Comparison", views: 6310, clicks: 982, conversions: 118, channel: "Blog" },
    { title: "5 Common O-Ring Failure Modes", views: 4870, clicks: 540, conversions: 64, channel: "Blog" },
    { title: "FKM vs FFKM: choosing your o-ring", views: 3420, clicks: 425, conversions: 38, channel: "LinkedIn" },
    { title: "PEEK in aerospace: high-performance plastic", views: 2980, clicks: 360, conversions: 29, channel: "LinkedIn" },
    { title: "Q2 2026 Newsletter — FFKM range & PEEK", views: 2210, clicks: 412, conversions: 51, channel: "Newsletter" },
  ],
  weeklyTraffic: [
    { week: "W1 Mar", sessions: 1820, pageViews: 4910, bounceRate: 48 },
    { week: "W2 Mar", sessions: 2140, pageViews: 5680, bounceRate: 46 },
    { week: "W3 Mar", sessions: 2580, pageViews: 6940, bounceRate: 44 },
    { week: "W4 Mar", sessions: 2890, pageViews: 7820, bounceRate: 43 },
    { week: "W1 Apr", sessions: 3008, pageViews: 8867, bounceRate: 42 },
  ],
  channelBreakdown: [
    { channel: "Blog/SEO", traffic: 7460, percentage: 60 },
    { channel: "LinkedIn", traffic: 2480, percentage: 20 },
    { channel: "Newsletter", traffic: 1490, percentage: 12 },
    { channel: "Direct", traffic: 998, percentage: 8 },
  ],
  qualityScores: [
    { metric: "Readability", score: 86, target: 80 },
    { metric: "Brand Tone", score: 91, target: 85 },
    { metric: "Technical Accuracy", score: 94, target: 90 },
    { metric: "SEO Optimization", score: 78, target: 80 },
    { metric: "Engagement Rate", score: 72, target: 70 },
  ],
  topPages: [
    { url: "/o-rings/material-selection-guide", sessions: 3420, bounce: 38, avgTime: "3m 12s", change: 18.4 },
    { url: "/plastics/peek-vs-pom-c", sessions: 2810, bounce: 41, avgTime: "2m 56s", change: 12.1 },
    { url: "/o-rings/fkm-ffkm-chemical-resistance", sessions: 1980, bounce: 45, avgTime: "2m 38s", change: 8.7 },
    { url: "/blog/o-ring-failure-modes", sessions: 1640, bounce: 39, avgTime: "3m 24s", change: 22.3 },
    { url: "/plastics/peek-aerospace-applications", sessions: 1320, bounce: 42, avgTime: "2m 51s", change: 6.4 },
    { url: "/o-rings/food-grade-epdm", sessions: 980, bounce: 47, avgTime: "2m 18s", change: -3.2 },
  ],
  topKeywords: [
    { keyword: "o-ring material selection guide", position: 4, clicks: 820, impressions: 9840, ctr: 8.3 },
    { keyword: "PEEK vs POM-C comparison", position: 3, clicks: 712, impressions: 7180, ctr: 9.9 },
    { keyword: "FKM o-rings high temperature", position: 6, clicks: 540, impressions: 8210, ctr: 6.6 },
    { keyword: "FFKM o-rings chemical resistance", position: 5, clicks: 418, impressions: 5640, ctr: 7.4 },
    { keyword: "POM-C machining tolerances", position: 8, clicks: 312, impressions: 4920, ctr: 6.3 },
    { keyword: "o-ring failure analysis guide", position: 4, clicks: 286, impressions: 3810, ctr: 7.5 },
  ],
  deviceSplit: [
    { device: "Desktop", percentage: 64 },
    { device: "Mobile", percentage: 31 },
    { device: "Tablet", percentage: 5 },
  ],
  topCountries: [
    { country: "Germany", flag: "🇩🇪", sessions: 4280, percentage: 34 },
    { country: "France", flag: "🇫🇷", sessions: 2640, percentage: 21 },
    { country: "Italy", flag: "🇮🇹", sessions: 1820, percentage: 15 },
    { country: "Switzerland", flag: "🇨🇭", sessions: 1410, percentage: 11 },
    { country: "Netherlands", flag: "🇳🇱", sessions: 980, percentage: 8 },
    { country: "Other EU", flag: "🇪🇺", sessions: 1308, percentage: 11 },
  ],
};
