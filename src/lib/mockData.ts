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
