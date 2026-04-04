// ── Mock data for APSO Marketing Hub ──
// All data is realistic for Angst+Pfister (industrial B2B parts distributor)

export const kpiData = {
  organicTraffic: { value: 48_720, change: 12.4, period: "vs last month" },
  keywordRankings: { value: 1_247, change: 8.2, period: "tracked keywords" },
  contentPieces: { value: 34, change: 22.0, period: "this quarter" },
  avgPosition: { value: 14.3, change: -2.1, period: "avg. SERP position" },
  clickThroughRate: { value: 3.8, change: 0.6, period: "organic CTR" },
  pipelineItems: { value: 12, change: 0, period: "in review pipeline" },
};

export const trafficChartData = [
  { month: "Oct", organic: 31200, paid: 8400, direct: 12300 },
  { month: "Nov", organic: 34800, paid: 7200, direct: 11800 },
  { month: "Dec", organic: 29400, paid: 9100, direct: 10200 },
  { month: "Jan", organic: 38200, paid: 8800, direct: 13100 },
  { month: "Feb", organic: 42100, paid: 7600, direct: 12900 },
  { month: "Mar", organic: 48720, paid: 9200, direct: 14200 },
];

export const contentPipelineData = [
  { status: "Draft", count: 5, color: "#f59e0b" },
  { status: "In Review", count: 4, color: "#3b82f6" },
  { status: "Approved", count: 3, color: "#10b981" },
  { status: "Published", count: 22, color: "#274e64" },
];

export const activityFeed = [
  { id: 1, type: "content" as const, message: "New blog draft: 'O-Ring Material Selection for High-Temperature Applications'", time: "12 min ago", status: "pending_review" as const },
  { id: 2, type: "seo" as const, message: "Keyword 'hydraulic seals supplier europe' moved from position 18 to 11", time: "1 hour ago", status: "positive" as const },
  { id: 3, type: "approval" as const, message: "Miriam approved LinkedIn post: 'PTFE vs FKM sealing solutions comparison'", time: "2 hours ago", status: "approved" as const },
  { id: 4, type: "content" as const, message: "Newsletter Q2 draft generated — awaiting topic approval", time: "3 hours ago", status: "pending_review" as const },
  { id: 5, type: "seo" as const, message: "Content gap detected: competitor ranking for 'industrial vibration dampening'", time: "5 hours ago", status: "action_needed" as const },
  { id: 6, type: "system" as const, message: "Weekly SEO pipeline run completed — 3 new content briefs generated", time: "6 hours ago", status: "info" as const },
  { id: 7, type: "approval" as const, message: "Aleksandra rejected draft: 'Pneumatic Fittings Overview' — tone adjustment needed", time: "1 day ago", status: "rejected" as const },
  { id: 8, type: "content" as const, message: "Blog published: 'How to Select the Right Conveyor Belt for Food Processing'", time: "1 day ago", status: "published" as const },
];

export const seoKeywords = [
  { keyword: "hydraulic seals supplier", volume: 2400, position: 11, change: -7, cpc: 4.20, difficulty: 42, url: "/products/hydraulic-seals", cannibalization: false, source: "GSC Quick Win" as const },
  { keyword: "o-ring manufacturer europe", volume: 1800, position: 8, change: -3, cpc: 3.80, difficulty: 55, url: "/products/o-rings", cannibalization: false, source: "GSC Quick Win" as const },
  { keyword: "PTFE sealing solutions", volume: 980, position: 15, change: -4, cpc: 5.10, difficulty: 38, url: "/products/ptfe-seals", cannibalization: false, source: "Content Gap" as const },
  { keyword: "industrial vibration dampening", volume: 3200, position: 0, change: 0, cpc: 2.90, difficulty: 61, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "conveyor belt food processing", volume: 1400, position: 22, change: -5, cpc: 3.50, difficulty: 44, url: "/applications/food-processing", cannibalization: false, source: "GSC Quick Win" as const },
  { keyword: "pneumatic fittings supplier", volume: 2100, position: 6, change: -2, cpc: 4.70, difficulty: 51, url: "/products/pneumatic-fittings", cannibalization: false, source: "Competitor" as const },
  { keyword: "rubber gasket custom", volume: 890, position: 19, change: -8, cpc: 3.20, difficulty: 35, url: "/products/gaskets", cannibalization: true, source: "GSC Quick Win" as const },
  { keyword: "fluid power components", volume: 1650, position: 31, change: -1, cpc: 4.00, difficulty: 67, url: "/products/fluid-power", cannibalization: false, source: "Editorial" as const },
  { keyword: "sealing solutions automotive", volume: 2800, position: 0, change: 0, cpc: 6.20, difficulty: 72, url: "", cannibalization: false, source: "Content Gap" as const },
  { keyword: "anti-vibration mounts industrial", volume: 1100, position: 14, change: -6, cpc: 3.40, difficulty: 40, url: "/products/anti-vibration", cannibalization: false, source: "GSC Quick Win" as const },
];

export const contentCalendarItems = [
  { id: "cal-1", title: "O-Ring Material Guide for High-Temp", date: "2026-04-07", channel: "Blog" as const, status: "draft" as const, assignee: "AI + Miriam", priority: "high" as const },
  { id: "cal-2", title: "LinkedIn: New PTFE product launch", date: "2026-04-08", channel: "LinkedIn" as const, status: "approved" as const, assignee: "Aleksandra", priority: "high" as const },
  { id: "cal-3", title: "Hydraulic Seals Buyer Guide", date: "2026-04-10", channel: "Blog" as const, status: "idea" as const, assignee: "Unassigned", priority: "medium" as const },
  { id: "cal-4", title: "Newsletter: Q2 Industrial Trends", date: "2026-04-11", channel: "Newsletter" as const, status: "in_review" as const, assignee: "Miriam", priority: "medium" as const },
  { id: "cal-5", title: "LinkedIn: Food Processing Case Study", date: "2026-04-14", channel: "LinkedIn" as const, status: "idea" as const, assignee: "Unassigned", priority: "low" as const },
  { id: "cal-6", title: "Vibration Dampening Solutions Blog", date: "2026-04-15", channel: "Blog" as const, status: "brief" as const, assignee: "AI", priority: "high" as const },
  { id: "cal-7", title: "LinkedIn: Industry 4.0 & Smart Sealing", date: "2026-04-16", channel: "LinkedIn" as const, status: "draft" as const, assignee: "Aleksandra", priority: "medium" as const },
  { id: "cal-8", title: "Conveyor Belt Selection Webinar Promo", date: "2026-04-17", channel: "Newsletter" as const, status: "approved" as const, assignee: "Miriam", priority: "high" as const },
  { id: "cal-9", title: "Pneumatic Systems Comparison Article", date: "2026-04-21", channel: "Blog" as const, status: "idea" as const, assignee: "Unassigned", priority: "medium" as const },
  { id: "cal-10", title: "LinkedIn: Sustainability in Sealing", date: "2026-04-22", channel: "LinkedIn" as const, status: "brief" as const, assignee: "AI", priority: "low" as const },
  { id: "cal-11", title: "Custom Gasket Solutions Guide", date: "2026-04-24", channel: "Blog" as const, status: "draft" as const, assignee: "AI + Miriam", priority: "high" as const },
  { id: "cal-12", title: "Newsletter: Sealing Innovation Roundup", date: "2026-04-28", channel: "Newsletter" as const, status: "idea" as const, assignee: "Unassigned", priority: "low" as const },
];

export const studioContentBriefs = [
  {
    id: "brief-1",
    title: "O-Ring Material Selection for High-Temperature Applications",
    keyword: "o-ring high temperature",
    reasoning: "GSC data shows position 15 for 'o-ring high temperature' with 980 monthly impressions but only 12 clicks (1.2% CTR). Moving to top 5 could yield 150+ monthly clicks. No cannibalization detected. Aligns with Q2 product focus.",
    status: "pending_approval" as const,
    score: 87,
    wordCount: 1800,
    channel: "Blog" as const,
    createdAt: "2026-04-03T10:30:00Z",
  },
  {
    id: "brief-2",
    title: "PTFE vs FKM: Choosing the Right Sealing Material",
    keyword: "PTFE vs FKM seals",
    reasoning: "Content gap analysis: top 3 competitors rank for this comparison keyword (1,400 monthly volume). APSOparts has no content targeting this term. High commercial intent (CPC $5.10). Supports product differentiation strategy.",
    status: "approved" as const,
    score: 92,
    wordCount: 2200,
    channel: "Blog" as const,
    createdAt: "2026-04-02T14:15:00Z",
  },
  {
    id: "brief-3",
    title: "5 Signs Your Hydraulic Seals Need Replacement",
    keyword: "hydraulic seal replacement",
    reasoning: "Editorial calendar injection — Miriam requested maintenance-focused content for spring campaign. Keyword has 890 monthly volume, position 28. Quick-win potential with targeted long-form content.",
    status: "generating" as const,
    score: 78,
    wordCount: 1500,
    channel: "Blog" as const,
    createdAt: "2026-04-04T08:00:00Z",
  },
];

export const knowledgeBaseDocuments = [
  { id: "kb-1", name: "APSO Brand Guidelines v3.2", type: "Brand" as const, size: "2.4 MB", lastUpdated: "2026-03-15", version: "3.2", shared: true },
  { id: "kb-2", name: "Product Catalog — Sealing Solutions", type: "Product" as const, size: "8.1 MB", lastUpdated: "2026-03-28", version: "2026-Q1", shared: true },
  { id: "kb-3", name: "Tone of Voice Document", type: "Brand" as const, size: "340 KB", lastUpdated: "2026-02-10", version: "2.0", shared: true },
  { id: "kb-4", name: "Competitor Analysis — Trelleborg", type: "Strategy" as const, size: "1.7 MB", lastUpdated: "2026-03-20", version: "1.0", shared: false },
  { id: "kb-5", name: "Technical Glossary (EN/DE/FR)", type: "Reference" as const, size: "520 KB", lastUpdated: "2026-01-30", version: "4.1", shared: true },
  { id: "kb-6", name: "SEO Keyword Master List", type: "SEO" as const, size: "180 KB", lastUpdated: "2026-04-01", version: "2026-04", shared: true },
  { id: "kb-7", name: "Product Catalog — Fluid Power", type: "Product" as const, size: "5.6 MB", lastUpdated: "2026-03-25", version: "2026-Q1", shared: true },
  { id: "kb-8", name: "Industry Application Guides", type: "Product" as const, size: "3.2 MB", lastUpdated: "2026-02-28", version: "1.3", shared: true },
];

export const auditLogs = [
  { id: "log-1", timestamp: "2026-04-04T10:30:22Z", action: "Content Generated" as const, user: "System (AI)", details: "Generated blog draft: 'O-Ring Material Selection...' | Keyword: o-ring high temperature | Model: claude-opus-4-6 | Tokens: 4,230", prompt: "Write a technical blog post about o-ring material selection for high-temperature industrial applications. Target keyword: 'o-ring high temperature'. Tone: professional, technical. Brand voice: authoritative B2B engineering partner...", input: "GSC data: position 15, impressions 980, clicks 12. KB docs: Product Catalog Sealing, Technical Glossary, Brand Guidelines v3.2", output: "# O-Ring Material Selection for High-Temperature Applications\n\nWhen operating temperatures exceed 200°C, standard elastomer o-rings begin to fail..." },
  { id: "log-2", timestamp: "2026-04-04T09:15:00Z", action: "Topic Approved" as const, user: "Miriam", details: "Approved content brief: 'PTFE vs FKM: Choosing the Right Sealing Material' — Score: 92/100", prompt: "", input: "", output: "" },
  { id: "log-3", timestamp: "2026-04-04T08:00:00Z", action: "Pipeline Run" as const, user: "System", details: "Weekly SEO pipeline executed. Analyzed 1,247 keywords from GSC. Generated 3 content briefs. Flagged 1 cannibalization risk.", prompt: "", input: "GSC API: 1,247 keywords | GA4 API: 48,720 organic sessions | Editorial calendar: 4 injected topics", output: "3 briefs generated, 1 cannibalization flag (rubber gasket custom), 0 duplicate topics in 6-month window" },
  { id: "log-4", timestamp: "2026-04-03T16:45:00Z", action: "Content Rejected" as const, user: "Aleksandra", details: "Rejected draft: 'Pneumatic Fittings Overview' — Reason: tone too casual, needs more technical depth", prompt: "", input: "", output: "" },
  { id: "log-5", timestamp: "2026-04-03T14:20:00Z", action: "Content Published" as const, user: "Miriam", details: "Published blog: 'How to Select the Right Conveyor Belt for Food Processing' — pushed to CMS as draft", prompt: "", input: "", output: "" },
  { id: "log-6", timestamp: "2026-04-03T11:00:00Z", action: "KB Updated" as const, user: "Aleksandra", details: "Updated 'Product Catalog — Sealing Solutions' to version 2026-Q1. 12 new product entries added.", prompt: "", input: "", output: "" },
  { id: "log-7", timestamp: "2026-04-02T15:30:00Z", action: "Content Generated" as const, user: "System (AI)", details: "Generated LinkedIn post: 'PTFE vs FKM comparison' | Model: claude-opus-4-6 | Tokens: 890", prompt: "Write a LinkedIn post comparing PTFE and FKM sealing materials...", input: "KB docs: Product Catalog Sealing, Tone of Voice Document", output: "Choosing between PTFE and FKM for your sealing application? Here's what you need to know..." },
];

export const analyticsData = {
  contentPerformance: [
    { title: "Conveyor Belt Selection Guide", views: 3420, clicks: 289, conversions: 12, channel: "Blog" },
    { title: "O-Ring Material Comparison", views: 2180, clicks: 198, conversions: 8, channel: "Blog" },
    { title: "PTFE Product Launch", views: 1850, clicks: 342, conversions: 0, channel: "LinkedIn" },
    { title: "Q1 Industrial Newsletter", views: 1200, clicks: 156, conversions: 5, channel: "Newsletter" },
    { title: "Hydraulic Seals Maintenance", views: 980, clicks: 87, conversions: 3, channel: "Blog" },
  ],
  weeklyTraffic: [
    { week: "W1 Mar", sessions: 10200, pageViews: 24800, bounceRate: 42 },
    { week: "W2 Mar", sessions: 11400, pageViews: 27200, bounceRate: 40 },
    { week: "W3 Mar", sessions: 10800, pageViews: 25600, bounceRate: 41 },
    { week: "W4 Mar", sessions: 12300, pageViews: 29100, bounceRate: 38 },
    { week: "W1 Apr", sessions: 13100, pageViews: 31400, bounceRate: 36 },
  ],
  channelBreakdown: [
    { channel: "Blog/SEO", traffic: 48720, percentage: 62 },
    { channel: "LinkedIn", traffic: 12400, percentage: 16 },
    { channel: "Newsletter", traffic: 8900, percentage: 11 },
    { channel: "Direct", traffic: 8600, percentage: 11 },
  ],
  qualityScores: [
    { metric: "Readability", score: 82, target: 80 },
    { metric: "Brand Tone", score: 91, target: 85 },
    { metric: "Technical Accuracy", score: 88, target: 90 },
    { metric: "SEO Optimization", score: 76, target: 80 },
    { metric: "Engagement Rate", score: 71, target: 70 },
  ],
};
