// The journey as the business defined it, shipped so the board is never empty.
// It is edited in the application now — stages, steps and every card — and the
// stored version replaces this one the moment anybody changes anything.

import type { JourneyModel } from "./model";

export const JOURNEY_SEED: JourneyModel = {
  "version": 2,
  "stages": [
    {
      "id": "awareness-problem-need-recognition",
      "name": "Awareness – Problem / Need Recognition",
      "position": 0,
      "description": "Triggered by maintenance, failure, restocking, or new projects",
      "mindset": "We need this part",
      "objective": "Be discoverable & credible",
      "lifecycle": null
    },
    {
      "id": "consideration-supplier-evaluation",
      "name": "Consideration – Supplier Evaluation",
      "position": 1,
      "description": "Buyers compare suppliers based on risk reduction and reliability",
      "mindset": "Can this supplier meet our requirements?",
      "objective": "Remove friction & uncertainty",
      "lifecycle": null
    },
    {
      "id": "validation-operational-fit-check",
      "name": "Validation – Operational Fit Check",
      "position": 2,
      "description": "Internal verification before purchase",
      "mindset": "Will this work within our systems & processes?",
      "objective": "Support decision-making",
      "lifecycle": "MQL or SQL (one qualified by CO)"
    },
    {
      "id": "purchase-efficiency-convenience",
      "name": "Purchase – Efficiency & Convenience",
      "position": 3,
      "description": "Focus on speed, accuracy, predictability",
      "mindset": "Make this fast and painless",
      "objective": "Make ordering effortless",
      "lifecycle": "New Customer (if no order for 365 day - Lost Lead)"
    },
    {
      "id": "post-purchase-reliability-test",
      "name": "Post-Purchase – Reliability Test",
      "position": 4,
      "description": "Experience determines future trust",
      "mindset": "Was this supplier reliable?",
      "objective": "Earn supplier status",
      "lifecycle": "New Customer (if no order for 365 day - Lost Lead)"
    },
    {
      "id": "repeat-purchase-habit-system-integration",
      "name": "Repeat Purchase – Habit & System Integration",
      "position": 5,
      "description": "Goal is becoming default supplier",
      "mindset": "Use the easiest & most reliable option",
      "objective": "Become the default supplier",
      "lifecycle": "If no second purchase in 6 months - New Customer Lost\nIf 2-11 Orders - Grow/Nurture\nIf 11+ - Loyalty/Reactivate\n\nIf 2+ orders and the last one was more than 6 months ago - Churn/Reactivate\nIf 1+ Order and last order was more than 2 years ago - Not Reactivated Customer"
    }
  ],
  "steps": [
    {
      "index": 1,
      "column": 2,
      "stageId": "awareness-problem-need-recognition",
      "label": "Find APSOparts on LLMs, Google, Bing…\nShould wish to click on the link…"
    },
    {
      "index": 2,
      "column": 3,
      "stageId": "consideration-supplier-evaluation",
      "label": "Visit APSOparts homepage"
    },
    {
      "index": 3,
      "column": 4,
      "stageId": "consideration-supplier-evaluation",
      "label": "Visit Product Detailed Pages"
    },
    {
      "index": 4,
      "column": 5,
      "stageId": "consideration-supplier-evaluation",
      "label": "Create an account to view prices and availability"
    },
    {
      "index": 5,
      "column": 6,
      "stageId": "consideration-supplier-evaluation",
      "label": "Once account is approved internally, it sees \"correct\" prices"
    },
    {
      "index": 6,
      "column": 7,
      "stageId": "validation-operational-fit-check",
      "label": "Check product informations, prices, availability"
    },
    {
      "index": 7,
      "column": 8,
      "stageId": "validation-operational-fit-check",
      "label": "Add products to cart, Share with engineering colleagues for technical validation"
    },
    {
      "index": 8,
      "column": 9,
      "stageId": "validation-operational-fit-check",
      "label": "Create APSOparts as supplier"
    },
    {
      "index": 9,
      "column": 10,
      "stageId": "purchase-efficiency-convenience",
      "label": "Make first purchase"
    },
    {
      "index": 10,
      "column": 11,
      "stageId": "purchase-efficiency-convenience",
      "label": "Get Order aknowlegment"
    },
    {
      "index": 11,
      "column": 12,
      "stageId": "purchase-efficiency-convenience",
      "label": "Contact Customer service if any question related to order"
    },
    {
      "index": 12,
      "column": 13,
      "stageId": "purchase-efficiency-convenience",
      "label": "Receive products"
    },
    {
      "index": 13,
      "column": 14,
      "stageId": "post-purchase-reliability-test",
      "label": "Enjoy product and evaluate reliability"
    },
    {
      "index": 14,
      "column": 15,
      "stageId": "repeat-purchase-habit-system-integration",
      "label": "Order again"
    },
    {
      "index": 15,
      "column": 16,
      "stageId": "repeat-purchase-habit-system-integration",
      "label": "Share experience"
    }
  ],
  "items": [
    {
      "id": "awareness-problem-need-recognition-touchpoint-0",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "SEO for technical queries",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-1",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Clear taxonomy",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-2",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Technical metadata",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-3",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Professional brand presence",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-4",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "SEO/GEO/SEA",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-5",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Ads offline/online",
      "origin": "workbook",
      "order": 5,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-6",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Social media",
      "origin": "workbook",
      "order": 6,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-7",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Article",
      "origin": "workbook",
      "order": 7,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-8",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "blogs",
      "origin": "workbook",
      "order": 8,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-9",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "emailing",
      "origin": "workbook",
      "order": 9,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-10",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Newsletter",
      "origin": "workbook",
      "order": 10,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-11",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Fairs",
      "origin": "workbook",
      "order": 11,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-12",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "ESO",
      "origin": "workbook",
      "order": 12,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-13",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "TSA",
      "origin": "workbook",
      "order": 13,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-14",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "BO",
      "origin": "workbook",
      "order": 14,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-15",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Webinar",
      "origin": "workbook",
      "order": 15,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-16",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Youtube videos",
      "origin": "workbook",
      "order": 16,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-17",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Hear from colleagues/peers",
      "origin": "workbook",
      "order": 17,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-18",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Directory search",
      "origin": "workbook",
      "order": 18,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-19",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Punchout",
      "origin": "workbook",
      "order": 19,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-20",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Get email from customer : Contact form",
      "origin": "workbook",
      "order": 20,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-21",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Chat",
      "origin": "workbook",
      "order": 21,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-touchpoint-22",
      "stageId": "awareness-problem-need-recognition",
      "kind": "touchpoint",
      "text": "Whitepaper",
      "origin": "workbook",
      "order": 22,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-risk-0",
      "stageId": "awareness-problem-need-recognition",
      "kind": "risk",
      "text": "Poor SEO/GEO",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-risk-1",
      "stageId": "awareness-problem-need-recognition",
      "kind": "risk",
      "text": "Unclear categorization",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-risk-2",
      "stageId": "awareness-problem-need-recognition",
      "kind": "risk",
      "text": "Weak credibility signals",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-question-0",
      "stageId": "awareness-problem-need-recognition",
      "kind": "question",
      "text": "Where new customers are coming from ? Direct/SEO/SEA/GEO…",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-question-1",
      "stageId": "awareness-problem-need-recognition",
      "kind": "question",
      "text": "Where existing customers are coming from ? Direct/SEO/SEA/GEO...",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-question-2",
      "stageId": "awareness-problem-need-recognition",
      "kind": "question",
      "text": "What do they see at this moment ? What is short text giving them envy to visit ?",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-question-3",
      "stageId": "awareness-problem-need-recognition",
      "kind": "question",
      "text": "Where is active direct remarketing ? Retention or Lead creation ?",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-0",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "KPIs from SMEC and Bespoke",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-1",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "Traffic by acquisition channel (Nb Impressions) (Available)",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-2",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "Brand recognition (Miriam's study)",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-3",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "Visibility score / AI visibility (Aleksandra's input in competitor)",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-4",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "Organic traffic",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-5",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "Search visibility",
      "origin": "workbook",
      "order": 5,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-6",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "AI/LLM visibility",
      "origin": "workbook",
      "order": 6,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-7",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "New visitors",
      "origin": "workbook",
      "order": 7,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-8",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "Bounce rate",
      "origin": "workbook",
      "order": 8,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-9",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "nb of people reached",
      "origin": "workbook",
      "order": 9,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-10",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "search impressions",
      "origin": "workbook",
      "order": 10,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-11",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "?? Impressions SEA / SEO / ??? -",
      "origin": "workbook",
      "order": 11,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-kpi-12",
      "stageId": "awareness-problem-need-recognition",
      "kind": "kpi",
      "text": "Brand Search Volume",
      "origin": "workbook",
      "order": 12,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-idea-0",
      "stageId": "awareness-problem-need-recognition",
      "kind": "idea",
      "text": "Improve technical SEO/GEO",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-idea-1",
      "stageId": "awareness-problem-need-recognition",
      "kind": "idea",
      "text": "Better product taxonomy",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-idea-2",
      "stageId": "awareness-problem-need-recognition",
      "kind": "idea",
      "text": "Strong trust signals",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-channel-0",
      "stageId": "awareness-problem-need-recognition",
      "kind": "channel",
      "text": "Google search",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-channel-1",
      "stageId": "awareness-problem-need-recognition",
      "kind": "channel",
      "text": "Technical SEO/GEO",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "awareness-problem-need-recognition-channel-2",
      "stageId": "awareness-problem-need-recognition",
      "kind": "channel",
      "text": "Category structure",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-touchpoint-0",
      "stageId": "consideration-supplier-evaluation",
      "kind": "touchpoint",
      "text": "Detailed specs",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-touchpoint-1",
      "stageId": "consideration-supplier-evaluation",
      "kind": "touchpoint",
      "text": "Datasheets",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-touchpoint-2",
      "stageId": "consideration-supplier-evaluation",
      "kind": "touchpoint",
      "text": "Stock visibility",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-touchpoint-3",
      "stageId": "consideration-supplier-evaluation",
      "kind": "touchpoint",
      "text": "Lead times",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-touchpoint-4",
      "stageId": "consideration-supplier-evaluation",
      "kind": "touchpoint",
      "text": "Certifications",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-touchpoint-5",
      "stageId": "consideration-supplier-evaluation",
      "kind": "touchpoint",
      "text": "Transparent pricing",
      "origin": "workbook",
      "order": 5,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-risk-0",
      "stageId": "consideration-supplier-evaluation",
      "kind": "risk",
      "text": "Missing specs",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-risk-1",
      "stageId": "consideration-supplier-evaluation",
      "kind": "risk",
      "text": "Unclear availability",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-risk-2",
      "stageId": "consideration-supplier-evaluation",
      "kind": "risk",
      "text": "Lack of trust indicators",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-question-0",
      "stageId": "consideration-supplier-evaluation",
      "kind": "question",
      "text": "Is the search good and fast enough for the customer to identify the product he is usually buying ?",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-question-1",
      "stageId": "consideration-supplier-evaluation",
      "kind": "question",
      "text": "Search function",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-question-2",
      "stageId": "consideration-supplier-evaluation",
      "kind": "question",
      "text": "Cross reference list with main competitors…",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-kpi-0",
      "stageId": "consideration-supplier-evaluation",
      "kind": "kpi",
      "text": "Success to come to our home page measure by:",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-kpi-1",
      "stageId": "consideration-supplier-evaluation",
      "kind": "kpi",
      "text": "Traffic by acquisition channel (Nb Sessions) (Available)",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-kpi-2",
      "stageId": "consideration-supplier-evaluation",
      "kind": "kpi",
      "text": "CTR by channel (Available)",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-idea-0",
      "stageId": "consideration-supplier-evaluation",
      "kind": "idea",
      "text": "Enhance product data",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-idea-1",
      "stageId": "consideration-supplier-evaluation",
      "kind": "idea",
      "text": "Display stock & lead times",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-idea-2",
      "stageId": "consideration-supplier-evaluation",
      "kind": "idea",
      "text": "Add certifications & proof",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-channel-0",
      "stageId": "consideration-supplier-evaluation",
      "kind": "channel",
      "text": "Product pages",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-channel-1",
      "stageId": "consideration-supplier-evaluation",
      "kind": "channel",
      "text": "Filtering UX",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "consideration-supplier-evaluation-channel-2",
      "stageId": "consideration-supplier-evaluation",
      "kind": "channel",
      "text": "Technical content",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-touchpoint-0",
      "stageId": "validation-operational-fit-check",
      "kind": "touchpoint",
      "text": "Documentation access",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-touchpoint-1",
      "stageId": "validation-operational-fit-check",
      "kind": "touchpoint",
      "text": "VAT/invoice clarity",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-touchpoint-2",
      "stageId": "validation-operational-fit-check",
      "kind": "touchpoint",
      "text": "Company details",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-touchpoint-3",
      "stageId": "validation-operational-fit-check",
      "kind": "touchpoint",
      "text": "Customer support",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-touchpoint-4",
      "stageId": "validation-operational-fit-check",
      "kind": "touchpoint",
      "text": "Bulk pricing",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-risk-0",
      "stageId": "validation-operational-fit-check",
      "kind": "risk",
      "text": "Procurement friction",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-risk-1",
      "stageId": "validation-operational-fit-check",
      "kind": "risk",
      "text": "Missing documentation",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-risk-2",
      "stageId": "validation-operational-fit-check",
      "kind": "risk",
      "text": "Pricing ambiguity",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-kpi-0",
      "stageId": "validation-operational-fit-check",
      "kind": "kpi",
      "text": "Quote requests",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-kpi-1",
      "stageId": "validation-operational-fit-check",
      "kind": "kpi",
      "text": "Contact/support interactions",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-kpi-2",
      "stageId": "validation-operational-fit-check",
      "kind": "kpi",
      "text": "Product page depth (avg. number of product pages viewed per session)",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-kpi-3",
      "stageId": "validation-operational-fit-check",
      "kind": "kpi",
      "text": "Datasheet / technical document downloads",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-kpi-4",
      "stageId": "validation-operational-fit-check",
      "kind": "kpi",
      "text": "Time spent on product pages.",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-kpi-5",
      "stageId": "validation-operational-fit-check",
      "kind": "kpi",
      "text": "Customer visiting without buying ? High number of views vs 0 orders => Why ? Price ? Stock ? Leadtime ?",
      "origin": "workbook",
      "order": 5,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-idea-0",
      "stageId": "validation-operational-fit-check",
      "kind": "idea",
      "text": "Provide full documentation",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-idea-1",
      "stageId": "validation-operational-fit-check",
      "kind": "idea",
      "text": "Clarify VAT/payment terms",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-idea-2",
      "stageId": "validation-operational-fit-check",
      "kind": "idea",
      "text": "Offer bulk/contract pricing",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-channel-0",
      "stageId": "validation-operational-fit-check",
      "kind": "channel",
      "text": "Support UX",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-channel-1",
      "stageId": "validation-operational-fit-check",
      "kind": "channel",
      "text": "Documentation",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "validation-operational-fit-check-channel-2",
      "stageId": "validation-operational-fit-check",
      "kind": "channel",
      "text": "Trust & compliance elements",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-touchpoint-0",
      "stageId": "purchase-efficiency-convenience",
      "kind": "touchpoint",
      "text": "Quick reorder",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-touchpoint-1",
      "stageId": "purchase-efficiency-convenience",
      "kind": "touchpoint",
      "text": "Saved carts",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-touchpoint-2",
      "stageId": "purchase-efficiency-convenience",
      "kind": "touchpoint",
      "text": "Bulk ordering",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-touchpoint-3",
      "stageId": "purchase-efficiency-convenience",
      "kind": "touchpoint",
      "text": "Account pricing",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-touchpoint-4",
      "stageId": "purchase-efficiency-convenience",
      "kind": "touchpoint",
      "text": "Multiple payment options",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-touchpoint-5",
      "stageId": "purchase-efficiency-convenience",
      "kind": "touchpoint",
      "text": "Fast checkout",
      "origin": "workbook",
      "order": 5,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-risk-0",
      "stageId": "purchase-efficiency-convenience",
      "kind": "risk",
      "text": "Complex checkout",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-risk-1",
      "stageId": "purchase-efficiency-convenience",
      "kind": "risk",
      "text": "Forced registration",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-risk-2",
      "stageId": "purchase-efficiency-convenience",
      "kind": "risk",
      "text": "Hidden costs",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-0",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "Checkout conversion rate",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-1",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "Cart abandonment rate",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-2",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "Order completion time",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-3",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "Purchase Conversion",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-4",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "First purchase rate",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-5",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "(Registrants → first order)",
      "origin": "workbook",
      "order": 5,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-6",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "Checkout completion rate",
      "origin": "workbook",
      "order": 6,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-7",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "(Carts → successful orders)",
      "origin": "workbook",
      "order": 7,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-8",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "Cart abandonment rate",
      "origin": "workbook",
      "order": 8,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-9",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "Conversion rate (session → order)",
      "origin": "workbook",
      "order": 9,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-kpi-10",
      "stageId": "purchase-efficiency-convenience",
      "kind": "kpi",
      "text": "Average order value (AOV)",
      "origin": "workbook",
      "order": 10,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-idea-0",
      "stageId": "purchase-efficiency-convenience",
      "kind": "idea",
      "text": "Streamline checkout",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-idea-1",
      "stageId": "purchase-efficiency-convenience",
      "kind": "idea",
      "text": "Enable guest/fast ordering",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-idea-2",
      "stageId": "purchase-efficiency-convenience",
      "kind": "idea",
      "text": "Improve bulk ordering tools",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-channel-0",
      "stageId": "purchase-efficiency-convenience",
      "kind": "channel",
      "text": "Checkout UX",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-channel-1",
      "stageId": "purchase-efficiency-convenience",
      "kind": "channel",
      "text": "Account system",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "purchase-efficiency-convenience-channel-2",
      "stageId": "purchase-efficiency-convenience",
      "kind": "channel",
      "text": "Ordering tools",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-touchpoint-0",
      "stageId": "post-purchase-reliability-test",
      "kind": "touchpoint",
      "text": "Order tracking",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-touchpoint-1",
      "stageId": "post-purchase-reliability-test",
      "kind": "touchpoint",
      "text": "Quality of product/Packaging",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-touchpoint-2",
      "stageId": "post-purchase-reliability-test",
      "kind": "touchpoint",
      "text": "Clear communication",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-touchpoint-3",
      "stageId": "post-purchase-reliability-test",
      "kind": "touchpoint",
      "text": "Reliable fulfillment",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-touchpoint-4",
      "stageId": "post-purchase-reliability-test",
      "kind": "touchpoint",
      "text": "Easy returns",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-touchpoint-5",
      "stageId": "post-purchase-reliability-test",
      "kind": "touchpoint",
      "text": "Professional invoices",
      "origin": "workbook",
      "order": 5,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-risk-0",
      "stageId": "post-purchase-reliability-test",
      "kind": "risk",
      "text": "Late deliveries",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-risk-1",
      "stageId": "post-purchase-reliability-test",
      "kind": "risk",
      "text": "Poor communication",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-risk-2",
      "stageId": "post-purchase-reliability-test",
      "kind": "risk",
      "text": "Invoicing errors",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-kpi-0",
      "stageId": "post-purchase-reliability-test",
      "kind": "kpi",
      "text": "Delivery satisfaction",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-kpi-1",
      "stageId": "post-purchase-reliability-test",
      "kind": "kpi",
      "text": "Return rate",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-kpi-2",
      "stageId": "post-purchase-reliability-test",
      "kind": "kpi",
      "text": "Support tickets",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-kpi-3",
      "stageId": "post-purchase-reliability-test",
      "kind": "kpi",
      "text": "Repeat order rate",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-kpi-4",
      "stageId": "post-purchase-reliability-test",
      "kind": "kpi",
      "text": "NPS Rate after first purchase (coming soon)",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-idea-0",
      "stageId": "post-purchase-reliability-test",
      "kind": "idea",
      "text": "Improve logistics visibility",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-idea-1",
      "stageId": "post-purchase-reliability-test",
      "kind": "idea",
      "text": "Automate communication",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-idea-2",
      "stageId": "post-purchase-reliability-test",
      "kind": "idea",
      "text": "Ensure invoice accuracy",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-channel-0",
      "stageId": "post-purchase-reliability-test",
      "kind": "channel",
      "text": "Order tracking",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-channel-1",
      "stageId": "post-purchase-reliability-test",
      "kind": "channel",
      "text": "Email communication",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "post-purchase-reliability-test-channel-2",
      "stageId": "post-purchase-reliability-test",
      "kind": "channel",
      "text": "Fulfillment experience",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-touchpoint-0",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "touchpoint",
      "text": "Reorder automation",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-touchpoint-1",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "touchpoint",
      "text": "Contract pricing",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-touchpoint-2",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "touchpoint",
      "text": "Standing orders",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-touchpoint-3",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "touchpoint",
      "text": "Personalized catalogs",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-touchpoint-4",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "touchpoint",
      "text": "Procurement compatibility",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-risk-0",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "risk",
      "text": "Better competitor pricing",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-risk-1",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "risk",
      "text": "Ordering friction",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-risk-2",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "risk",
      "text": "Poor account tools",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-question-0",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "question",
      "text": "Who are loyal customers ? Who are lost customers ?",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-kpi-0",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "kpi",
      "text": "Customer lifetime value",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-kpi-1",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "kpi",
      "text": "Repeat order frequency",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-kpi-2",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "kpi",
      "text": "Retention rate",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-kpi-3",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "kpi",
      "text": "Average order value",
      "origin": "workbook",
      "order": 3,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-kpi-4",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "kpi",
      "text": "NPS  (Current one)",
      "origin": "workbook",
      "order": 4,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-idea-0",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "idea",
      "text": "Introduce reorder shortcuts",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-idea-1",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "idea",
      "text": "Contract pricing",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-idea-2",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "idea",
      "text": "Personalized accounts",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-channel-0",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "channel",
      "text": "Account UX",
      "origin": "workbook",
      "order": 0,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-channel-1",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "channel",
      "text": "Reordering tools",
      "origin": "workbook",
      "order": 1,
      "done": false
    },
    {
      "id": "repeat-purchase-habit-system-integration-channel-2",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "channel",
      "text": "Retention strategy",
      "origin": "workbook",
      "order": 2,
      "done": false
    },
    {
      "id": "uc-1",
      "stageId": "consideration-supplier-evaluation",
      "kind": "usecase",
      "text": "Create UC for chat/customer form leads who are not yet registered (pending legal advice - GDPR)",
      "origin": "workbook",
      "order": 0,
      "status": "open"
    },
    {
      "id": "uc-2",
      "stageId": "validation-operational-fit-check",
      "kind": "usecase",
      "text": "Upcoming UC: Recovery of customers who checked prices and did not put the article in the cart (coming P10)",
      "origin": "workbook",
      "order": 0,
      "status": "open"
    },
    {
      "id": "uc-3",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "usecase",
      "text": "UC10 & UC11 to be redone in P10-11",
      "origin": "workbook",
      "order": 0,
      "status": "open"
    },
    {
      "id": "uc-4",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "usecase",
      "text": "UC12 to be redone taking into account order intake (P10)",
      "origin": "workbook",
      "order": 1,
      "status": "open"
    },
    {
      "id": "uc-5",
      "stageId": "repeat-purchase-habit-system-integration",
      "kind": "usecase",
      "text": "Upcoming new UC: a purchaser who has not logged in for a while and may have left the company (P10)",
      "origin": "workbook",
      "order": 2,
      "status": "open"
    }
  ],
  "funnels": [
    {
      "id": "mql-sql-lost-lead",
      "path": [
        "MQL",
        "SQL",
        "Lost Lead"
      ],
      "note": "This could be visualized as a funnel to show what percentage of companies ultimately end up in the Lost Lead stage."
    },
    {
      "id": "mql-sql-new-customer-new-customer-lost",
      "path": [
        "MQL",
        "SQL",
        "New Customer",
        "New Customer Lost"
      ],
      "note": "Another possible linear path that can be tracked similarly to understand conversion and drop-off rates."
    },
    {
      "id": "new-customer-lost-not-reactivated-customer",
      "path": [
        "New Customer Lost",
        "Not Reactivated Customer"
      ],
      "note": "A customer who made only one purchase can transition from New Customer Lost to Not Reactivated Customer if there’s no further activity."
    },
    {
      "id": "churn-reactivate-not-reactivated-customer",
      "path": [
        "Churn/Reactivate",
        "Not Reactivated Customer"
      ],
      "note": "We consider this a \"danger zone.\" It’s important to see how many companies transition to Not Reactivated Customer, as they are essentially lost."
    },
    {
      "id": "not-reactivated-customer-reactivated-customer",
      "path": [
        "Not Reactivated Customer",
        "Reactivated Customer"
      ],
      "note": "Track how many companies manage to return from Not Reactivated to Reactivated Customer."
    }
  ],
  "source": {
    "origin": "Customer Journey APSOparts, the business definition of 23.09.2026",
    "definedAt": "2026-09-23T00:00:00.000Z"
  },
  "issues": [],
  "title": "APSOparts customer journey"
};
