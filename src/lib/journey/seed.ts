// GENERATED — the customer-journey workbook as it stood on 23.09.2026, shipped so the
// application is not empty before anyone uploads. A real import replaces it: the stored
// version always wins. Regenerate by importing the newer workbook through the app.
//
// Source: Customer Journey APSOparts-260923.xlsx (sheets "Customer Journey" and "KPIsNeeded")

import type { JourneyModel } from "./model";

export const JOURNEY_SEED: JourneyModel = {
  "version": 1,
  "stages": [
    {
      "id": "awareness-problem-need-recognition",
      "name": "Awareness – Problem / Need Recognition",
      "column": 2,
      "span": 1,
      "description": "Triggered by maintenance, failure, restocking, or new projects",
      "mindset": "We need this part",
      "action": "Search by part number/specs, Search by topic, Scan suppliers quickly, Shortlist viable options",
      "behaviour": "Reactive, problem-driven, urgency-oriented",
      "objective": "Be discoverable & credible",
      "lifecycle": null,
      "upcoming": null,
      "questions": "Where new customers are coming from ? Direct/SEO/SEA/GEO…\nWhere existing customers are coming from ? Direct/SEO/SEA/GEO...\n\nWhat do they see at this moment ? What is short text giving them envy to visit ?\n\nWhere is active direct remarketing ? Retention or Lead creation ?",
      "touchpoints": "SEO for technical queries, Clear taxonomy, Technical metadata, Professional brand presence\nSEO/GEO/SEA, Ads offline/online, Social media, Article, blogs, emailing, Newsletter, Fairs, ESO, TSA, BO, Webinar, Youtube videos, Hear from colleagues/peers, Directory search, Punchout\n\nGet email from customer : Contact form, Chat, Whitepaper",
      "risks": "Poor SEO/GEO, Unclear categorization, Weak credibility signals",
      "ideas": "Improve technical SEO/GEO, Better product taxonomy, Strong trust signals",
      "channels": "Google search, Technical SEO/GEO, Category structure",
      "kpis": "KPIs from SMEC and Bespoke\n\nTraffic by acquisition channel (Nb Impressions) (Available)\nBrand recognition (Miriam's study)\nVisibility score / AI visibility (Aleksandra's input in competitor)\n\nOrganic traffic, Search visibility, AI/LLM visibility, New visitors, Bounce rate\n, nb of people reached, search impressions\n?? Impressions SEA / SEO / ??? - \nBrand Search Volume"
    },
    {
      "id": "consideration-supplier-evaluation",
      "name": "Consideration – Supplier Evaluation",
      "column": 3,
      "span": 4,
      "description": "Buyers compare suppliers based on risk reduction and reliability",
      "mindset": "Can this supplier meet our requirements?",
      "action": "Compare specs/pricing/availability, Review documentation, Evaluate credibility",
      "behaviour": "Analytical, risk-reducing, comparison-focused",
      "objective": "Remove friction & uncertainty",
      "lifecycle": null,
      "upcoming": "Create UC for chat/customer form leads who are not yet registered (pending legal advice - GDPR)",
      "questions": "Is the search good and fast enough for the customer to identify the product he is usually buying ?\nSearch function, Cross reference list with main competitors…",
      "touchpoints": "Detailed specs, Datasheets, Stock visibility, Lead times, Certifications, Transparent pricing",
      "risks": "Missing specs, Unclear availability, Lack of trust indicators",
      "ideas": "Enhance product data, Display stock & lead times, Add certifications & proof",
      "channels": "Product pages, Filtering UX, Technical content",
      "kpis": "Success to come to our home page measure by:\n\nTraffic by acquisition channel (Nb Sessions) (Available)\nCTR by channel (Available)"
    },
    {
      "id": "validation-operational-fit-check",
      "name": "Validation – Operational Fit Check",
      "column": 7,
      "span": 3,
      "description": "Internal verification before purchase",
      "mindset": "Will this work within our systems & processes?",
      "action": "Verify compatibility, Check approvals/budget, Contact support if needed",
      "behaviour": "Cautious, compliance-oriented, internally aligned",
      "objective": "Support decision-making",
      "lifecycle": "MQL or SQL (one qualified by CO)",
      "upcoming": "Upcoming UC: Recovery of Customers who checked prices and did not put the article in the cart (coming P10)",
      "questions": null,
      "touchpoints": "Documentation access, VAT/invoice clarity, Company details, Customer support, Bulk pricing",
      "risks": "Procurement friction, Missing documentation, Pricing ambiguity",
      "ideas": "Provide full documentation, Clarify VAT/payment terms, Offer bulk/contract pricing",
      "channels": "Support UX, Documentation, Trust & compliance elements",
      "kpis": "Quote requests,\nContact/support interactions,\nProduct page depth (avg. number of product pages viewed per session),\nDatasheet / technical document downloads,\nTime spent on product pages. \n\nCustomer visiting without buying ? High number of views vs 0 orders => Why ? Price ? Stock ? Leadtime ?"
    },
    {
      "id": "purchase-efficiency-convenience",
      "name": "Purchase – Efficiency & Convenience",
      "column": 10,
      "span": 4,
      "description": "Focus on speed, accuracy, predictability",
      "mindset": "Make this fast and painless",
      "action": "Reorder or bulk order, Minimize checkout time, Use known workflows",
      "behaviour": "Efficiency-driven, friction-sensitive",
      "objective": "Make ordering effortless",
      "lifecycle": "New Customer (if no order for 365 day - Lost Lead)",
      "upcoming": null,
      "questions": null,
      "touchpoints": "Quick reorder, Saved carts, Bulk ordering, Account pricing, Multiple payment options, Fast checkout",
      "risks": "Complex checkout, Forced registration, Hidden costs",
      "ideas": "Streamline checkout, Enable guest/fast ordering, Improve bulk ordering tools",
      "channels": "Checkout UX, Account system, Ordering tools",
      "kpis": "Checkout conversion rate,\nCart abandonment rate,\nOrder completion time,\nPurchase Conversion,\nFirst purchase rate\n(Registrants → first order),\nCheckout completion rate\n(Carts → successful orders),\nCart abandonment rate,\nConversion rate (session → order),\nAverage order value (AOV)"
    },
    {
      "id": "post-purchase-reliability-test",
      "name": "Post-Purchase – Reliability Test",
      "column": 14,
      "span": 1,
      "description": "Experience determines future trust",
      "mindset": "Was this supplier reliable?",
      "action": "Track delivery, Inspect product consistency, Evaluate supplier reliability",
      "behaviour": "Performance-evaluating, trust-building",
      "objective": "Earn supplier status",
      "lifecycle": "New Customer (if no order for 365 day - Lost Lead)",
      "upcoming": null,
      "questions": null,
      "touchpoints": "Order tracking, Quality of product/Packaging, Clear communication, Reliable fulfillment, Easy returns, Professional invoices",
      "risks": "Late deliveries, Poor communication, Invoicing errors",
      "ideas": "Improve logistics visibility, Automate communication, Ensure invoice accuracy",
      "channels": "Order tracking, Email communication, Fulfillment experience",
      "kpis": "Delivery satisfaction,\nReturn rate,\nSupport tickets,\nRepeat order rate,\nNPS Rate after first purchase (coming soon)"
    },
    {
      "id": "repeat-purchase-habit-system-integration",
      "name": "Repeat Purchase – Habit & System Integration",
      "column": 15,
      "span": 2,
      "description": "Goal is becoming default supplier",
      "mindset": "Use the easiest & most reliable option",
      "action": "Use reorder tools, Standardize supplier, Integrate into procurement routines",
      "behaviour": "Habitual, system-optimizing, loyalty-based",
      "objective": "Become the default supplier",
      "lifecycle": "If no second purchase in 6 months - New Customer Lost\nIf 2-11 Orders - Grow/Nurture\nIf 11+ - Loyalty/Reactivate\n\nIf 2+ orders and the last one was more than 6 months ago - Churn/Reactivate\nIf 1+ Order and last order was more than 2 years ago - Not Reactivated Customer",
      "upcoming": "UC10&11 to be redone in P10-11\nUC12 to be redone taking into account OI (P10)\nUpcoming new UC: if a purchaser did not login for a while and might have let the company (P10)",
      "questions": "Who are loyal customers ? Who are lost customers ?",
      "touchpoints": "Reorder automation, Contract pricing, Standing orders, Personalized catalogs, Procurement compatibility",
      "risks": "Better competitor pricing, Ordering friction, Poor account tools",
      "ideas": "Introduce reorder shortcuts, Contract pricing, Personalized accounts",
      "channels": "Account UX, Reordering tools, Retention strategy",
      "kpis": "Customer lifetime value,\nRepeat order frequency,\nRetention rate,\nAverage order value,\nNPS  (Current one)"
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
    "fileName": "Customer Journey APSOparts-260923.xlsx",
    "sheet": "Customer Journey",
    "importedAt": "2026-09-23T00:00:00.000Z",
    "importedBy": "shipped with the application",
    "rowMap": [
      {
        "field": "description",
        "label": "Description",
        "row": 2
      },
      {
        "field": "mindset",
        "label": "Buyer Mindset",
        "row": 3
      },
      {
        "field": "action",
        "label": "Buyer Action",
        "row": 4
      },
      {
        "field": "behaviour",
        "label": "Buyer Behaviour",
        "row": 5
      },
      {
        "field": "objective",
        "label": "APSOparts Objective",
        "row": 6
      },
      {
        "field": "steps",
        "label": "Journey with APSOparts",
        "row": 7
      },
      {
        "field": "lifecycle",
        "label": "Life cycles Hubspot",
        "row": 10
      },
      {
        "field": "upcoming",
        "label": "Additional/Update UC to come",
        "row": 11
      },
      {
        "field": "questions",
        "label": "Questions to answer",
        "row": 12
      },
      {
        "field": "touchpoints",
        "label": "Critical Touchpoints",
        "row": 13
      },
      {
        "field": "risks",
        "label": "Typical Drop-off Risks",
        "row": 14
      },
      {
        "field": "ideas",
        "label": "Optimization Ideas",
        "row": 15
      },
      {
        "field": "channels",
        "label": "Key Channels / UX Focus",
        "row": 16
      },
      {
        "field": "kpis",
        "label": "KPIs to put in place",
        "row": 17
      }
    ]
  },
  "issues": []
};
