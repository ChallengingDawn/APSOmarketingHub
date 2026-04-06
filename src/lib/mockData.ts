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
    text: "Specifying an o-ring for aggressive chemicals? FKM and FFKM look similar on a datasheet — but the wrong call costs you a line stop.\n\n✅ FKM (Viton®) — fuels, oils, hydrocarbons & most acids, continuous service up to +200 °C. The cost-efficient workhorse.\n✅ FFKM (Kalrez®-class) — near-universal chemical compatibility up to +325 °C, for amines, ketones, steam & strong oxidisers.\n\nAt APSOparts we stock both in standard and metric sizes, with custom compounds available on request. Send us your media + temperature window — our sealing engineers reply within 24 h with a shortlist.\n\n👉 Talk to a sealing specialist: apsoparts.com\n\n#ORings #Sealing #FKM #FFKM #ChemicalResistance #APSOparts",
    reasoning: "High-engagement format (comparison + emoji) for technical audience. Targets engineers searching FKM vs FFKM. Aligns with Q2 sealing focus.",
    qualityScore: 91,
    theme: "oring-fkm",
  },
  {
    id: "li-2",
    channel: "LinkedIn",
    title: "PEEK in aerospace: the high-performance plastic explained",
    topic: "PEEK aerospace applications",
    text: "Why is PEEK quietly replacing metal across modern aircraft?\n\n🚀 Continuous service up to +260 °C\n🚀 Self-extinguishing — UL94 V-0 rated\n🚀 Outstanding chemical, wear & fatigue resistance\n🚀 Up to 70 % lighter than equivalent steel parts\n\nBack-up rings, bushings, isolators, seal carriers — PEEK delivers the strength of metal at a fraction of the weight, with full traceability. APSOparts machines PEEK to drawing in our European workshops, from prototype to series.\n\n👉 Request a quote on your PEEK part: apsoparts.com\n\n#PEEK #Aerospace #EngineeredPlastics #Lightweighting #APSOparts",
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

  /* ── Newsletter (5) ── */
  {
    id: "nl-1",
    channel: "Newsletter",
    title: "Q2 Sealings & Plastics Update — What's New at APSOparts",
    topic: "Q2 product newsletter",
    text: "This quarter at APSOparts:\n\n• New FFKM o-ring range for ultra-high chemical resistance\n• Expanded PEEK machined parts catalog\n• POM-C precision components — now in stock\n• Technical webinar: Material selection for high-temperature sealing\n\nRead the full update inside.",
    reasoning: "Quarterly digest format. Highlights new products to drive engagement and sales conversations.",
    qualityScore: 90,
    theme: "newsletter-q2",
  },
  {
    id: "nl-2",
    channel: "Newsletter",
    title: "O-Ring Material Selection: A Technical Deep-Dive",
    topic: "o-ring material guide",
    text: "Choosing the right o-ring material shouldn't be guesswork.\n\nIn this issue:\n• FKM, FFKM, EPDM, NBR & Silicone compared\n• Temperature & chemical resistance charts\n• Industry-specific recommendations\n• When to specify custom compounds\n\nA must-read for design and procurement engineers.",
    reasoning: "Educational deep-dive serves as lead magnet. Positions APSOparts as material expert.",
    qualityScore: 92,
    theme: "oring-guide",
  },
  {
    id: "nl-3",
    channel: "Newsletter",
    title: "PEEK vs POM-C: Which Engineering Plastic for Your Application?",
    topic: "PEEK vs POM-C comparison",
    text: "Two of the most popular engineering plastics — but which one is right for you?\n\nThis newsletter walks through:\n• Mechanical properties side-by-side\n• Temperature & chemical resistance\n• Machinability & cost considerations\n• Application examples from APSOparts customers",
    reasoning: "Comparison content drives high engagement. Targets undecided buyers in the design phase.",
    qualityScore: 88,
    theme: "peek-pomc",
  },
  {
    id: "nl-4",
    channel: "Newsletter",
    title: "Industry Spotlight: Sealing Solutions for Pharma Manufacturing",
    topic: "pharma sealing solutions",
    text: "Pharmaceutical manufacturing has zero tolerance for contamination.\n\nLearn how APSOparts supports pharma producers with:\n• USP Class VI compliant elastomers\n• EPDM, silicone & FFKM for CIP/SIP cycles\n• Lot traceability & full documentation\n• Custom compounds for specific media",
    reasoning: "Industry-vertical content for high-value market. Compliance angle critical for pharma buyers.",
    qualityScore: 89,
    theme: "pharma",
  },
  {
    id: "nl-5",
    channel: "Newsletter",
    title: "Predictive Maintenance: When to Replace Your Seals",
    topic: "predictive maintenance",
    text: "Unplanned downtime costs more than scheduled replacement.\n\nIn this issue:\n• Visual inspection checklist\n• Common failure modes & root causes\n• Replacement intervals by application\n• Working with APSOparts on maintenance contracts",
    reasoning: "Maintenance content reaches operations & MRO buyers. Drives repeat business and service contracts.",
    qualityScore: 87,
    theme: "maintenance",
  },

  /* ── Blog (5) ── */
  {
    id: "bl-1",
    channel: "Blog",
    title: "O-Ring Material Selection Guide — FKM, FFKM & Silicone for Demanding Applications",
    topic: "o-ring material selection",
    text: "Selecting the right o-ring material for high-temperature environments is critical to ensuring seal integrity and preventing costly equipment failures. Applications in automotive, aerospace, and industrial processing regularly expose seals to sustained temperatures above 200°C, where standard elastomers lose their mechanical properties.\n\nFluoroelastomers (FKM) remain the most popular choice for continuous service up to 200°C, offering excellent chemical resistance alongside thermal stability. For even more demanding conditions, perfluoroelastomers (FFKM) extend the operating window to 320°C while maintaining near-universal chemical compatibility.",
    reasoning: "Cornerstone content targeting 'o-ring material selection guide' (2,400 vol/mo, difficulty 42). Long-form pillar article.",
    qualityScore: 92,
    theme: "oring-guide",
  },
  {
    id: "bl-2",
    channel: "Blog",
    title: "PEEK vs POM-C: Engineering Plastics Comparison for Precision Components",
    topic: "PEEK vs POM-C",
    text: "When designing precision components, the choice between PEEK and POM-C can dramatically impact performance, cost, and lifespan. Both materials offer excellent machinability and dimensional stability, but their properties diverge sharply at the extremes.\n\nPEEK delivers superior temperature resistance (up to 260°C continuous), chemical compatibility, and mechanical strength — making it the go-to for aerospace, medical, and high-performance industrial applications. POM-C, by contrast, offers excellent value for room-temperature applications requiring tight tolerances, low friction, and consistent dimensional behaviour.",
    reasoning: "Targets 2,100 vol/mo comparison keyword. Strategic for plastics product line. Strong commercial intent.",
    qualityScore: 90,
    theme: "peek-pomc",
  },
  {
    id: "bl-3",
    channel: "Blog",
    title: "Common O-Ring Failure Modes and How to Prevent Them",
    topic: "o-ring failure analysis",
    text: "O-rings are deceptively simple components, but their failure can bring entire systems to a halt. Understanding the common failure modes helps engineers specify the right material the first time and predict replacement intervals accurately.\n\nThe most common failure modes include compression set, chemical attack, thermal degradation, extrusion, and abrasion. Each has distinct visual signatures and root causes — and each is preventable with the right material selection and installation practices.",
    reasoning: "Maintenance/troubleshooting content drives organic traffic from engineers diagnosing field issues.",
    qualityScore: 88,
    theme: "oring-failure",
  },
  {
    id: "bl-4",
    channel: "Blog",
    title: "PEEK Machined Parts for Aerospace Sealing — A Complete Specification Guide",
    topic: "PEEK aerospace sealing",
    text: "Aerospace sealing applications demand materials that perform reliably under extreme conditions: wide temperature swings, aggressive chemicals, and zero tolerance for failure. PEEK has emerged as a leading choice for back-up rings, bushings, and seal components in modern aircraft.\n\nThis guide covers the key properties of PEEK relevant to aerospace, including grade selection, machining tolerances, certification requirements, and case studies from APSOparts' aerospace customers.",
    reasoning: "Vertical-specific cornerstone content for aerospace. PEEK is core product line. High-value B2B vertical.",
    qualityScore: 91,
    theme: "peek-aerospace",
  },
  {
    id: "bl-5",
    channel: "Blog",
    title: "POM-C Acetal Copolymer: Properties, Applications & Machining Tolerances",
    topic: "POM-C properties",
    text: "POM-C (polyoxymethylene copolymer) is one of the workhorses of engineering plastics. Its combination of dimensional stability, low friction, and excellent machinability makes it the default choice for precision mechanical components.\n\nThis comprehensive guide covers POM-C's mechanical and thermal properties, common applications across industries, machining best practices, and how to specify POM-C components with APSOparts for tight-tolerance projects.",
    reasoning: "Pillar content for POM-C product line. Targets engineers researching material specifications.",
    qualityScore: 87,
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
