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
  { id: 1, type: "content" as const, message: "New content brief: 'O-Ring Material Selection Guide — FKM, FFKM & Silicone for High-Temperature Applications'", time: "12 min ago", status: "pending_review" as const },
  { id: 2, type: "content" as const, message: "Draft generated: 'POM-C vs PEEK — Choosing Engineered Plastics for Precision Components'", time: "1 hour ago", status: "pending_review" as const },
  { id: 3, type: "approval" as const, message: "Miriam approved topic: 'Custom O-Rings for Food & Beverage Processing — EPDM and Silicone'", time: "2 hours ago", status: "approved" as const },
  { id: 4, type: "content" as const, message: "Brief generated: 'PEEK Machined Parts for Aerospace Sealing Applications'", time: "3 hours ago", status: "pending_review" as const },
  { id: 5, type: "system" as const, message: "Knowledge base updated: 'POM-C Material Data Sheet 2026' uploaded", time: "5 hours ago", status: "info" as const },
  { id: 6, type: "approval" as const, message: "Aleksandra requested changes: 'O-Ring Failure Analysis Guide' — needs PEEK back-up ring section", time: "6 hours ago", status: "action_needed" as const },
  { id: 7, type: "content" as const, message: "Content calendar: 4 new topics added focusing on PEEK and POM-C engineering plastics", time: "1 day ago", status: "info" as const },
  { id: 8, type: "system" as const, message: "Brand voice document v2.1 — added o-ring & engineered plastics terminology", time: "1 day ago", status: "info" as const },
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
    text: "Choosing between FKM and FFKM o-rings? Here's what matters for chemical resistance:\n\n✅ FKM: Excellent for fuels, oils & most acids — service up to +200°C\n✅ FFKM: The ultimate chemical resistance — handles aggressive media up to +325°C\n\nThe right choice depends on your media, temperature, and budget. Our engineers help you select the optimal material for your sealing challenge.\n\n#ORings #Sealing #FKM #FFKM #APSOparts",
    reasoning: "High-engagement format (comparison + emoji) for technical audience. Targets engineers searching FKM vs FFKM. Aligns with Q2 sealing focus.",
    qualityScore: 91,
    theme: "oring-fkm",
  },
  {
    id: "li-2",
    channel: "LinkedIn",
    title: "PEEK in aerospace: the high-performance plastic explained",
    topic: "PEEK aerospace applications",
    text: "Why does aerospace love PEEK?\n\n🚀 Operating temperature up to +260°C\n🚀 Self-extinguishing (V-0 rating)\n🚀 Outstanding chemical & wear resistance\n🚀 Lightweight alternative to metals\n\nFrom bushings to seal back-up rings, PEEK is replacing metal components across modern aircraft. APSOparts machines PEEK to your exact specifications.\n\n#PEEK #Aerospace #EngineeredPlastics #APSOparts",
    reasoning: "Industry-vertical content targeting aerospace engineers. PEEK is key product line. Format leverages curiosity hook.",
    qualityScore: 88,
    theme: "peek-aerospace",
  },
  {
    id: "li-3",
    channel: "LinkedIn",
    title: "POM-C precision parts: when tolerances matter",
    topic: "POM-C machining tolerances",
    text: "POM-C (acetal copolymer) is the engineer's choice when you need:\n\n⚙️ Tight tolerances (±0.05mm achievable)\n⚙️ Excellent dimensional stability\n⚙️ Low friction & wear\n⚙️ Food-contact compliance available\n\nFrom gears to bushings to precision housings, POM-C delivers consistent performance. Available in rod, sheet & custom-machined parts at APSOparts.\n\n#POMC #EngineeringPlastics #PrecisionParts #APSOparts",
    reasoning: "Educational content about a flagship plastic. Targets procurement and design engineers. Lists concrete benefits.",
    qualityScore: 85,
    theme: "pomc",
  },
  {
    id: "li-4",
    channel: "LinkedIn",
    title: "5 signs your o-rings need replacing",
    topic: "o-ring failure analysis",
    text: "Don't wait for a leak. Watch for these warning signs:\n\n1️⃣ Surface cracking or hardening\n2️⃣ Compression set (loss of elasticity)\n3️⃣ Swelling or shrinkage\n4️⃣ Discoloration\n5️⃣ Sticky or tacky surface\n\nPredictive replacement saves downtime. Need help selecting the right replacement material? APSOparts engineers are here.\n\n#ORings #Maintenance #Sealing #APSOparts",
    reasoning: "Listicle format performs well on LinkedIn. Maintenance angle reaches operations managers. Strong CTA.",
    qualityScore: 89,
    theme: "oring-failure",
  },
  {
    id: "li-5",
    channel: "LinkedIn",
    title: "Custom o-rings for food & beverage processing",
    topic: "food-grade EPDM o-rings",
    text: "Food and beverage processing demands more than ordinary sealing.\n\n🍽️ FDA-compliant materials\n🍽️ EPDM, silicone & FKM food-grade options\n🍽️ Steam & CIP resistant\n🍽️ Custom sizes & profiles available\n\nAPSOparts supplies certified o-rings to food processing leaders across Europe. Your application — our solution.\n\n#FoodSafety #ORings #EPDM #APSOparts",
    reasoning: "Vertical-specific (F&B) targets a high-value industry. Compliance angle resonates with regulated buyers.",
    qualityScore: 86,
    theme: "oring-food",
  },

  /* ── Newsletter (5) — full email format ── */
  {
    id: "nl-1",
    channel: "Newsletter",
    title: "Q2 2026 — New FFKM range, expanded PEEK catalog & spring webinar",
    topic: "Q2 product newsletter",
    text: "📬 Subject: Q2 at APSOparts — what's new in sealings & plastics\n\nHi {first_name},\n\nSpring is here and so is a fresh batch of products and resources to help your team build better, seal tighter, and ship faster.\n\n— What's new this quarter —\n\n🔹 FFKM o-ring range\nUltra-high chemical resistance for the most demanding aggressive media. Standard sizes shipping from stock; custom compounds in 2 weeks.\n\n🔹 Expanded PEEK machined parts catalog\n40+ new standard items for aerospace, semiconductor and medical applications. Tight tolerances, full traceability.\n\n🔹 POM-C precision components — now in stock\nGears, bushings, and housings ready to ship. No more 6-week lead times.\n\n— Free technical webinar —\nApril 24 · 14:00 CET\n\"Material selection for high-temperature sealing\"\n→ Reserve your seat\n\n— Talk to an engineer —\nNeed help specifying? Our application engineers offer free 30-min consultations.\n→ Book a call\n\nTo your next perfect seal,\nThe APSOparts Team",
    reasoning: "Quarterly digest format with 3 product sections + webinar + consultation CTA. Drives both immediate orders and lead capture.",
    qualityScore: 90,
    theme: "newsletter-q2",
  },
  {
    id: "nl-2",
    channel: "Newsletter",
    title: "[New Guide] How to choose the right o-ring material in 5 questions",
    topic: "o-ring material guide",
    text: "📬 Subject: The 5 questions that determine your o-ring material\n\nHi {first_name},\n\nWe see it every week: a great design, the wrong elastomer, and a seal that fails after 3 months in service. The right material is rarely the most expensive — it's the one that matches your application.\n\nThis week we published a free guide that walks engineers through the 5 questions you need to answer before specifying:\n\n1️⃣ What's the operating temperature range?\n2️⃣ What media will the seal contact?\n3️⃣ Static or dynamic application?\n4️⃣ What pressure & duty cycle?\n5️⃣ Any compliance requirements (FDA, USP, EU 1935)?\n\nThe guide includes a temperature/chemical compatibility matrix for FKM, FFKM, EPDM, NBR, and Silicone — printable for your engineering desk.\n\n→ Download the free guide (PDF, no email required)\n\nNeed help on a specific application? Send us your specs and our engineers will recommend the right material within 1 business day.\n→ Request a free material consultation\n\nUntil next time,\nThe APSOparts Team",
    reasoning: "Lead magnet format with downloadable PDF. The 5-question framework is memorable and shareable. Two CTAs: download + consultation.",
    qualityScore: 92,
    theme: "oring-guide",
  },
  {
    id: "nl-3",
    channel: "Newsletter",
    title: "PEEK vs POM-C — which one fits your next project? (decision tree inside)",
    topic: "PEEK vs POM-C comparison",
    text: "📬 Subject: PEEK or POM-C? Here's how to decide in 30 seconds\n\nHi {first_name},\n\nDesign engineers ask us this almost every week: \"Should I spec PEEK or POM-C?\" The honest answer is — it depends on three things.\n\n— The 30-second decision tree —\n\n✅ Need >120 °C continuous service? → PEEK\n✅ Aggressive chemicals or steam? → PEEK\n✅ Aerospace / medical / semicon certifications? → PEEK\n\n✅ Room-temperature mechanical part? → POM-C\n✅ Tight tolerances at lower cost? → POM-C\n✅ Food-contact compliance only? → POM-C\n\n— The cost reality —\nPEEK is roughly 8-12× the material cost of POM-C. When the application doesn't justify it, POM-C delivers excellent performance at a fraction of the price.\n\n— Free side-by-side comparison sheet —\nTemperature, chemical resistance, mechanical properties, machinability, and indicative pricing — all on one page.\n→ Download the comparison sheet\n\n— Need samples? —\nWe send free 50×50 mm POM-C and PEEK sample plates to qualified engineers.\n→ Request samples\n\nTo your next great design,\nThe APSOparts Team",
    reasoning: "Decision-tree format reduces cognitive load. Free sample CTA generates qualified leads. Honest cost talk builds trust.",
    qualityScore: 91,
    theme: "peek-pomc",
  },
  {
    id: "nl-4",
    channel: "Newsletter",
    title: "Pharma sealing: how a CIP/SIP-resistant FFKM cut downtime by 40%",
    topic: "pharma sealing case study",
    text: "📬 Subject: A pharma case study you'll want to share with your team\n\nHi {first_name},\n\nA European pharma manufacturer was replacing seals every 6 weeks. Frequent CIP/SIP cycles, aggressive cleaning agents, and tight production windows meant every unplanned stop cost them five-figure losses.\n\nHere's what we changed — and the result.\n\n— The problem —\nStandard EPDM seals were swelling under repeated steam sterilization. Maintenance teams were swapping rings 9× per year per skid.\n\n— The solution —\nWe specified an FFKM compound (USP Class VI compliant) rated for 200+ CIP/SIP cycles. Same dimensions, same fitting — drop-in replacement.\n\n— The result —\n✅ 40% reduction in unplanned downtime\n✅ Seal replacement cycle extended from 6 weeks to 6 months\n✅ Annual savings: €78,000 across 12 skids\n✅ Full lot traceability for audit compliance\n\n— Working with regulated industries —\nAPSOparts supplies USP Class VI, EU 1935/2004, and FDA-compliant elastomers with full documentation. Every batch comes with a CoC and lot traceability.\n\n→ Download the full case study (PDF)\n→ Talk to our pharma applications engineer\n\nTo cleaner production lines,\nThe APSOparts Team",
    reasoning: "Case-study format with quantified results (40%, €78k) is the most persuasive content for B2B. Targets pharma decision-makers.",
    qualityScore: 93,
    theme: "pharma",
  },
  {
    id: "nl-5",
    channel: "Newsletter",
    title: "Predictive maintenance: the visual checklist that catches o-ring failures early",
    topic: "predictive maintenance",
    text: "📬 Subject: Spot a failing o-ring before it costs you a shutdown\n\nHi {first_name},\n\nThe most expensive o-ring is the one that fails on a Friday night. Most failures give visual warnings days or weeks in advance — if you know what to look for.\n\n— The 5-point visual inspection checklist —\n\n1️⃣ Surface cracking → thermal degradation\n2️⃣ Hardening → over-temperature exposure\n3️⃣ Swelling → chemical incompatibility\n4️⃣ Compression set → wrong material or over-compression\n5️⃣ Tackiness or discoloration → end of service life\n\n— Replacement intervals by application —\nWe've put together replacement guidelines based on real customer data across hydraulics, food processing, pharma, and chemical industries.\n\n→ Download the maintenance guide\n\n— On-call APSOparts maintenance support —\nFor critical systems, we offer scheduled replacement programs with consigned inventory on your site. No more emergency orders.\n\n→ Learn about our maintenance contracts\n\nKeep your lines running,\nThe APSOparts Team",
    reasoning: "Maintenance angle for MRO buyers and operations managers. Drives repeat business through service contracts.",
    qualityScore: 88,
    theme: "maintenance",
  },

  /* ── Blog (5) — full article format ── */
  {
    id: "bl-1",
    channel: "Blog",
    title: "O-Ring Material Selection Guide: FKM, FFKM & Silicone for Demanding Applications",
    topic: "o-ring material selection",
    text: "📰 Reading time: 8 min · Audience: design & maintenance engineers\n\nSelecting the right o-ring material for high-temperature, chemically aggressive environments is one of the most consequential decisions in mechanical design. Get it wrong, and a $0.50 elastomer ring can shut down a $500k production line.\n\n— Why material selection matters more than you think —\n\nAt sustained temperatures above 200 °C, standard elastomers begin to lose their mechanical properties. Compression set increases, chemical resistance drops, and the seal that worked perfectly in lab testing fails in the field within weeks. The cost of premature failure far outweighs the marginal cost of upgrading to a higher-performance compound.\n\n— FKM (Fluoroelastomer) — the workhorse —\n\nFKM remains the most popular high-performance choice for continuous service up to 200 °C. It offers excellent resistance to oils, fuels, most acids, and aliphatic hydrocarbons. Standard FKM is the right choice for 80% of demanding applications where temperature stays below 200 °C.\n\n• Service temp: -20 to +200 °C (some grades to +230 °C)\n• Cost: medium-high\n• Best for: automotive, fuel systems, hydraulics, chemical processing\n\n— FFKM (Perfluoroelastomer) — when failure is not an option —\n\nWhen the application demands the absolute best, FFKM extends the operating window to 320 °C while delivering near-universal chemical compatibility. Yes, it's expensive — typically 20× the cost of FKM — but for critical applications in semiconductors, pharma, and aerospace, the math works.\n\n• Service temp: -20 to +320 °C\n• Cost: very high\n• Best for: semiconductor, pharma CIP/SIP, aggressive chemicals, ultra-high-temp\n\n— Silicone — the temperature champion —\n\nSilicone deserves a mention for its unique low-temperature performance: flexibility down to -60 °C, intermittent service to +230 °C. Less chemically resistant than FKM, but unbeatable for thermal cycling and food/medical contact.\n\n— How APSOparts helps you decide —\n\nOur application engineers offer free 30-minute material consultations. Send us your operating conditions and we'll recommend the right compound — usually within one business day.\n\n→ Request a free material consultation\n→ Download the temperature/chemical compatibility chart\n\nNeed samples? We send free 50 mm o-ring samples in any of these materials to qualified engineers.",
    reasoning: "Cornerstone pillar article (8-min read) targeting 'o-ring material selection guide' (2,400 vol/mo). 3 material sections + cost guidance + 2 CTAs (consultation + samples).",
    qualityScore: 94,
    theme: "oring-guide",
  },
  {
    id: "bl-2",
    channel: "Blog",
    title: "PEEK vs POM-C: Engineering Plastics Comparison for Precision Components",
    topic: "PEEK vs POM-C",
    text: "📰 Reading time: 6 min · Audience: design engineers, procurement\n\nWhen designing precision components, the choice between PEEK and POM-C can shift your bill of materials by 10× and your part lifespan by 5×. Both materials are excellent — but they're excellent at different things.\n\n— The headline difference —\n\nPEEK is a high-performance thermoplastic engineered for extreme environments. POM-C (acetal copolymer) is the workhorse plastic that delivers excellent precision and value at room temperature. Confuse them and you either over-spec (and burn budget) or under-spec (and burn the part).\n\n— Side-by-side specifications —\n\n📊 Continuous service temp\nPEEK: 260 °C  |  POM-C: 100 °C\n\n📊 Tensile strength (MPa)\nPEEK: 100  |  POM-C: 65\n\n📊 Chemical resistance\nPEEK: excellent (acids, bases, solvents)  |  POM-C: good (limited vs strong acids)\n\n📊 Machinability\nPEEK: good, but tool wear is real  |  POM-C: excellent — chips clean, holds tolerance\n\n📊 Cost (€/kg, indicative)\nPEEK: €90-120  |  POM-C: €8-12\n\n— When to choose PEEK —\n\n✅ Continuous service above 120 °C\n✅ Aggressive chemicals (steam, strong acids)\n✅ Aerospace, medical, semiconductor certifications required\n✅ High mechanical loads at elevated temperature\n✅ Ultra-low outgassing for vacuum applications\n\n— When to choose POM-C —\n\n✅ Room-temperature mechanical parts\n✅ Tight tolerances at lower cost\n✅ Gears, bushings, slide rails, manifolds\n✅ Food-contact compliance only (not pharma)\n✅ High-volume production where cost matters\n\n— Real customer example —\n\nA Swiss machine builder was using PEEK for guide bushings at €34 per part. We re-engineered to POM-C for the same application — room temperature, no chemicals — at €4 per part. Same lifespan. Annual savings: €18,000 across one product line.\n\n— Get the right material —\n\nAPSOparts stocks both PEEK and POM-C in rod, sheet, and machined parts. Our engineers help you specify the right grade based on your application — not the most expensive one.\n\n→ Request free PEEK and POM-C samples\n→ Talk to a plastics application engineer",
    reasoning: "High-intent comparison (2,100 vol/mo). Detailed spec table + customer example with savings number. Two free CTAs.",
    qualityScore: 93,
    theme: "peek-pomc",
  },
  {
    id: "bl-3",
    channel: "Blog",
    title: "5 Common O-Ring Failure Modes (and How to Prevent Each One)",
    topic: "o-ring failure analysis",
    text: "📰 Reading time: 7 min · Audience: maintenance, operations, design engineers\n\nO-rings are deceptively simple — until one fails on a Friday night and shuts down your line until Monday. The good news: most failures are predictable, visible, and preventable.\n\nHere are the 5 failure modes we see most often in the field, along with the root causes and the fix.\n\n— 1. Compression set —\n\nWhat it looks like: the o-ring is permanently deformed, no longer round in cross-section.\nRoot cause: wrong material, over-compression, or service temperature too high.\nThe fix: switch to a higher-temperature elastomer (FKM or FFKM) and verify groove design.\n\n— 2. Chemical attack —\n\nWhat it looks like: swelling, softening, or hardening; sometimes color change.\nRoot cause: incompatible elastomer for the media in contact.\nThe fix: check the chemical compatibility chart for your media. Often this means upgrading from NBR to FKM, or FKM to FFKM.\n\n— 3. Thermal degradation —\n\nWhat it looks like: surface cracking, brittleness, glazed appearance.\nRoot cause: service temperature exceeds the elastomer's rated limit.\nThe fix: either reduce operating temperature (rarely possible) or upgrade material.\n\n— 4. Extrusion —\n\nWhat it looks like: nibbled or torn edges where the ring squeezed into a clearance gap.\nRoot cause: too much pressure, too soft a material, or an oversized clearance.\nThe fix: add a back-up ring (PEEK or PTFE), increase elastomer hardness, or reduce gap.\n\n— 5. Installation damage —\n\nWhat it looks like: cuts, scratches, or torn sections.\nRoot cause: sharp edges in the housing, poor lubrication, or rough handling.\nThe fix: deburr edges, use proper assembly lube, train installers.\n\n— How to prevent failures before they happen —\n\nThe single best investment in seal reliability is a 30-minute conversation with an applications engineer before you finalize the design. We've seen 5-figure savings just from changing one elastomer grade.\n\n→ Request a free seal failure review (send us a photo)\n→ Download the failure-mode visual reference card",
    reasoning: "Listicle structure (5 modes) is highly engaging and shareable. Each mode has visual cues + fix. Strong CTAs for engagement.",
    qualityScore: 91,
    theme: "oring-failure",
  },
  {
    id: "bl-4",
    channel: "Blog",
    title: "PEEK Machined Parts for Aerospace Sealing — A Complete Specification Guide",
    topic: "PEEK aerospace sealing",
    text: "📰 Reading time: 9 min · Audience: aerospace design engineers, certification leads\n\nAerospace sealing applications demand materials that perform reliably under extreme conditions: wide temperature swings (-55 to +260 °C), aggressive jet fuels and hydraulic fluids, and absolutely zero tolerance for failure. PEEK has earned its place as the leading choice for back-up rings, bushings, bearings, and seal components in modern commercial and military aircraft.\n\n— Why aerospace chose PEEK —\n\n✅ Continuous service to +260 °C (intermittent +310 °C)\n✅ Self-extinguishing (UL 94 V-0 rating)\n✅ Excellent resistance to jet fuels, hydraulic fluids, de-icing fluids\n✅ Lightweight: 1.32 g/cm³ — significantly lighter than aluminum or steel\n✅ Outstanding fatigue and creep resistance\n✅ Low outgassing — meets vacuum/space requirements\n\n— PEEK grades commonly used in aerospace —\n\n• Standard PEEK (unfilled): general sealing, seals, low-friction\n• PEEK-GF30 (30% glass-filled): higher stiffness, dimensional stability\n• PEEK-CF30 (30% carbon-filled): lowest creep, highest mechanical strength\n• PEEK-HPV (bearing grade): self-lubricating for dynamic applications\n\n— Tolerances and machining considerations —\n\nPEEK machines well but demands sharp tooling and proper coolant. APSOparts holds standard tolerances of ±0.05 mm on machined parts, with tighter tolerances available for critical sealing surfaces. We recommend stress-relief annealing for parts with tight dimensional requirements.\n\n— Certifications and traceability —\n\nFor aerospace customers, we provide full material certification (3.1 per EN 10204), batch traceability, and dimensional inspection reports. PEEK supplied to AS9100 supply chains comes with the documentation your QA team needs.\n\n— Application examples —\n\n🛩 Hydraulic system back-up rings (replace metal back-ups, save weight)\n🛩 Fuel system bushings (replaces bronze, no lubrication required)\n🛩 Engine accessory drive bearings (high temp, low maintenance)\n🛩 Cabin pressurization seal carriers\n\n— Working with APSOparts —\n\nWe machine PEEK to your drawing in batches from 1 to 10,000 pieces. Standard lead time is 2-3 weeks; expedite available for AOG situations. Free samples for qualification programs.\n\n→ Request a quote for PEEK machined parts\n→ Download the PEEK aerospace specification sheet\n→ Talk to an aerospace applications engineer",
    reasoning: "Long-form (9-min) cornerstone content for aerospace vertical. Covers grades, tolerances, certifications, and applications. 3 specific CTAs.",
    qualityScore: 95,
    theme: "peek-aerospace",
  },
  {
    id: "bl-5",
    channel: "Blog",
    title: "POM-C Acetal Copolymer: Properties, Applications & Machining Tolerances",
    topic: "POM-C properties",
    text: "📰 Reading time: 7 min · Audience: design engineers, procurement, machinists\n\nPOM-C (polyoxymethylene copolymer) is the unsung hero of engineering plastics. While PEEK gets the headlines, POM-C quietly handles 90% of room-temperature precision applications — at a fraction of the cost.\n\n— What makes POM-C special —\n\nPOM-C combines five properties that are hard to find together:\n\n✅ Excellent dimensional stability — minimal moisture absorption\n✅ Low friction and good wear resistance\n✅ Outstanding machinability — chips clean, holds ±0.05 mm easily\n✅ Good chemical resistance to fuels, oils, solvents\n✅ Affordable: typically €8-12/kg for standard grades\n\n— Mechanical properties at a glance —\n\n📊 Tensile strength: 65 MPa\n📊 Elongation at break: 25%\n📊 Continuous service temp: -40 to +100 °C\n📊 Density: 1.41 g/cm³\n📊 Water absorption (24h): 0.2%\n\n— Where POM-C shines —\n\n⚙️ Precision gears (spur, helical, worm)\n⚙️ Bushings and slide bearings\n⚙️ Conveyor components — wear strips, chain guides, sprockets\n⚙️ Pump components — impellers, housings, seals\n⚙️ Manifold blocks for pneumatic/hydraulic systems\n⚙️ Food-contact parts (EU 1935/2004 compliant grades)\n\n— Where POM-C is not the answer —\n\nPOM-C is brilliant within its envelope, but it has limits. Don't use POM-C if your application involves:\n\n❌ Continuous service above 100 °C\n❌ Strong acids or oxidizing agents\n❌ UV exposure (without stabilization)\n❌ Pharmaceutical or USP Class VI requirements\n\nFor those applications, look at PEEK, PEI, or PVDF instead.\n\n— Machining tips for POM-C —\n\nPOM-C is one of the easiest plastics to machine. A few practical tips from our shop floor:\n\n• Sharp tools, low feed rates → mirror-finish surfaces\n• No coolant required for most operations (compressed air is enough)\n• Stress-relief if you need tight tolerances on thin sections\n• Cycle times typically 30-50% faster than steel\n\n— APSOparts POM-C product range —\n\nWe stock POM-C in rod (Ø6 to Ø300 mm), sheet (1 to 50 mm thick), and tube. Custom-machined parts available from a single prototype to production runs of 50,000+.\n\n→ Request a quote for POM-C machined parts\n→ Download the POM-C technical datasheet\n→ Order POM-C samples (free for qualified projects)",
    reasoning: "Pillar article on POM-C with full property table, application list, machining tips, and limitations. Covers selection AND objections. 3 CTAs.",
    qualityScore: 92,
    theme: "pomc",
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
    { title: "PTFE vs FKM Sealing Comparison", views: 0, clicks: 0, conversions: 0, channel: "Blog" },
    { title: "PTFE Sealing Solutions Launch Post", views: 0, clicks: 0, conversions: 0, channel: "LinkedIn" },
    { title: "Sealings & Plastics Q2 Newsletter", views: 0, clicks: 0, conversions: 0, channel: "Newsletter" },
    { title: "Rubber Gaskets Maintenance Guide", views: 0, clicks: 0, conversions: 0, channel: "Blog" },
  ],
  weeklyTraffic: [
    { week: "W1 Mar", sessions: 0, pageViews: 0, bounceRate: 0 },
    { week: "W2 Mar", sessions: 0, pageViews: 0, bounceRate: 0 },
    { week: "W3 Mar", sessions: 0, pageViews: 0, bounceRate: 0 },
    { week: "W4 Mar", sessions: 0, pageViews: 0, bounceRate: 0 },
    { week: "W1 Apr", sessions: 0, pageViews: 0, bounceRate: 0 },
  ],
  channelBreakdown: [
    { channel: "Blog/SEO", traffic: 0, percentage: 0 },
    { channel: "LinkedIn", traffic: 0, percentage: 0 },
    { channel: "Newsletter", traffic: 0, percentage: 0 },
    { channel: "Direct", traffic: 0, percentage: 0 },
  ],
  qualityScores: [
    { metric: "Readability", score: 0, target: 80 },
    { metric: "Brand Tone", score: 0, target: 85 },
    { metric: "Technical Accuracy", score: 0, target: 90 },
    { metric: "SEO Optimization", score: 0, target: 80 },
    { metric: "Engagement Rate", score: 0, target: 70 },
  ],
};
