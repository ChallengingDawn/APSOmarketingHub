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
  { id: 1, type: "content" as const, message: "New content brief created: 'O-Ring Material Selection Guide for High-Temperature Sealing'", time: "12 min ago", status: "pending_review" as const },
  { id: 2, type: "content" as const, message: "Draft generated: 'PTFE vs FKM — Choosing the Right Sealing Material for Chemical Resistance'", time: "1 hour ago", status: "pending_review" as const },
  { id: 3, type: "approval" as const, message: "Miriam approved topic: 'Custom Rubber Gaskets for Food & Beverage Processing'", time: "2 hours ago", status: "approved" as const },
  { id: 4, type: "content" as const, message: "Brief generated: 'Engineered Plastics in Hydraulic Systems — PEEK vs POM Comparison'", time: "3 hours ago", status: "pending_review" as const },
  { id: 5, type: "system" as const, message: "Knowledge base updated: 'APSOparts Sealing Product Catalog v2026-Q2' uploaded", time: "5 hours ago", status: "info" as const },
  { id: 6, type: "approval" as const, message: "Aleksandra requested changes on: 'Silicone Rubber in Medical Device Sealing' — needs more technical depth", time: "6 hours ago", status: "action_needed" as const },
  { id: 7, type: "content" as const, message: "Content calendar updated: 4 new topics added for April focusing on plastic components", time: "1 day ago", status: "info" as const },
  { id: 8, type: "system" as const, message: "Brand voice document updated to v2.1 — added plastics terminology guidelines", time: "1 day ago", status: "info" as const },
];

export const seoKeywords = [
  { keyword: "o-ring sealing solutions", volume: 2400, position: 0, change: 0, cpc: 4.20, difficulty: 42, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "PTFE sealing manufacturer europe", volume: 1800, position: 0, change: 0, cpc: 3.80, difficulty: 55, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "FKM rubber gaskets industrial", volume: 980, position: 0, change: 0, cpc: 5.10, difficulty: 38, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "engineered plastics components", volume: 3200, position: 0, change: 0, cpc: 2.90, difficulty: 61, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "custom rubber seals manufacturer", volume: 1400, position: 0, change: 0, cpc: 3.50, difficulty: 44, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "PEEK plastic machined parts", volume: 2100, position: 0, change: 0, cpc: 4.70, difficulty: 51, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "silicone gasket food grade", volume: 890, position: 0, change: 0, cpc: 3.20, difficulty: 35, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "hydraulic seal replacement guide", volume: 1650, position: 0, change: 0, cpc: 4.00, difficulty: 67, url: "", cannibalization: false, source: "Editorial" as const },
  { keyword: "NBR vs EPDM rubber comparison", volume: 2800, position: 0, change: 0, cpc: 6.20, difficulty: 72, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "POM acetal plastic applications", volume: 1100, position: 0, change: 0, cpc: 3.40, difficulty: 40, url: "", cannibalization: false, source: "Content Gap" as const },
];

export const contentCalendarItems = [
  { id: "cal-1", title: "O-Ring Material Selection for High-Temp Sealing", date: "2026-04-07", channel: "Blog" as const, status: "draft" as const, assignee: "AI + Miriam", priority: "high" as const },
  { id: "cal-2", title: "LinkedIn: PTFE Sealing Solutions Launch", date: "2026-04-08", channel: "LinkedIn" as const, status: "approved" as const, assignee: "Aleksandra", priority: "high" as const },
  { id: "cal-3", title: "Custom Rubber Gaskets Buyer Guide", date: "2026-04-10", channel: "Blog" as const, status: "idea" as const, assignee: "Unassigned", priority: "medium" as const },
  { id: "cal-4", title: "Newsletter: Sealings & Plastics Q2 Trends", date: "2026-04-11", channel: "Newsletter" as const, status: "in_review" as const, assignee: "Miriam", priority: "medium" as const },
  { id: "cal-5", title: "LinkedIn: Food-Grade Silicone Gaskets Case Study", date: "2026-04-14", channel: "LinkedIn" as const, status: "idea" as const, assignee: "Unassigned", priority: "low" as const },
  { id: "cal-6", title: "Engineered Plastics in Hydraulic Systems", date: "2026-04-15", channel: "Blog" as const, status: "brief" as const, assignee: "AI", priority: "high" as const },
  { id: "cal-7", title: "LinkedIn: PEEK vs POM — When to Use Which", date: "2026-04-16", channel: "LinkedIn" as const, status: "draft" as const, assignee: "Aleksandra", priority: "medium" as const },
  { id: "cal-8", title: "Rubber Seal Maintenance & Replacement Guide", date: "2026-04-17", channel: "Newsletter" as const, status: "approved" as const, assignee: "Miriam", priority: "high" as const },
  { id: "cal-9", title: "NBR vs EPDM: Material Comparison Article", date: "2026-04-21", channel: "Blog" as const, status: "idea" as const, assignee: "Unassigned", priority: "medium" as const },
  { id: "cal-10", title: "LinkedIn: Sustainability in Engineered Plastics", date: "2026-04-22", channel: "LinkedIn" as const, status: "brief" as const, assignee: "AI", priority: "low" as const },
  { id: "cal-11", title: "FKM vs Silicone Sealing Solutions Guide", date: "2026-04-24", channel: "Blog" as const, status: "draft" as const, assignee: "AI + Miriam", priority: "high" as const },
  { id: "cal-12", title: "Newsletter: Plastics Innovation Roundup", date: "2026-04-28", channel: "Newsletter" as const, status: "idea" as const, assignee: "Unassigned", priority: "low" as const },
];

export const studioContentBriefs = [
  {
    id: "brief-1",
    title: "O-Ring Material Selection for High-Temperature Sealing Applications",
    keyword: "o-ring high temperature sealing",
    reasoning: "Target keyword 'o-ring high temperature sealing' has estimated volume of 980/mo with moderate difficulty (42/100). APSOparts has no content targeting this term. High commercial intent (CPC $4.20). Supports Q2 sealing solutions product focus. Recommended approach: technical guide comparing FKM, FFKM, and silicone o-ring materials for applications above 200°C.",
    status: "pending_approval" as const,
    score: 87,
    wordCount: 1800,
    channel: "Blog" as const,
    createdAt: "2026-04-03T10:30:00Z",
  },
  {
    id: "brief-2",
    title: "PTFE vs FKM: Choosing the Right Sealing Material for Chemical Resistance",
    keyword: "PTFE vs FKM seals",
    reasoning: "Content gap analysis: competitors rank for this comparison keyword (est. 1,400 monthly volume). APSOparts has no comparison content for these two key sealing materials. High commercial intent (CPC $5.10). Supports product differentiation strategy. Recommended format: detailed comparison table with application scenarios.",
    status: "approved" as const,
    score: 92,
    wordCount: 2200,
    channel: "Blog" as const,
    createdAt: "2026-04-02T14:15:00Z",
  },
  {
    id: "brief-3",
    title: "Engineered Plastics in Hydraulic Systems — PEEK vs POM Guide",
    keyword: "PEEK vs POM hydraulic",
    reasoning: "Editorial calendar injection — strategic topic for plastics product line expansion. PEEK and POM are key engineered plastics in APSOparts portfolio. Keyword 'PEEK vs POM' has est. 890/mo volume. Opportunity to position APSOparts as technical authority in engineered plastics for fluid power applications.",
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
