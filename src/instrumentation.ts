// Runs once when a server process starts (Next.js instrumentation hook).
//
// Only the Node runtime: the DoC timer needs Postgres, SMTP and node:https. Keep
// the import INSIDE this exact `if` - Next compiles the hook for the edge runtime
// too, and only this form lets the compiler drop pg from that bundle (an early
// `return` does not, and the build fails on 'fs' and 'path').
export async function register() {
  // The sandbox copy (Railway, coded data only) starts NONE of the schedulers below: its network guard first, then
  // only the jobs SANDBOX_JOBS names - src/lib/sandbox/boot.ts. Same `if` form, so the edge bundle still drops it.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.APSOHUB_SANDBOX === "1") {
    const { startSandbox } = await import("./lib/sandbox/boot");
    await startSandbox();
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.APSOHUB_SANDBOX !== "1") {
    // first: every HubSpot search of this copy books its turn in the hub-wide queue (both copies together stay under
    // HubSpot's per-app limit; SARCLA 19.10.2026). Before the schedulers below, so none searches outside it.
    const { installSharedSearchQueue } = await import("./lib/integrations/searchQueue");
    installSharedSearchQueue();
    // HUB_JOBS=off: this copy starts NONE of the scheduled jobs below - its pages and buttons only. For the copy in the
    // new AWS accounts (MarketingHub-Dev, 06.11.2026): it runs on a restored copy of the live database with the live
    // keys while the sandbox still does the real work, so with its jobs on every e-mail, ticket and ERP pull would
    // happen twice. Unset everywhere else, so nothing changes there. Still inside the nodejs `if`, so the edge bundle
    // drops it with the rest.
    if (process.env.HUB_JOBS === "off") {
      console.log("[jobs] HUB_JOBS=off - no scheduled job started on this copy (pages and buttons only)");
      return;
    }
    const { startDocScheduler } = await import("./lib/doc/scheduler");
    startDocScheduler();
    // erosion tickets, once a day after the connector's nightly chain (EROSION_DETECTOR=live)
    const { startErosionScheduler } = await import("./lib/erosion/scheduler");
    startErosionScheduler();
    // Articles CY/LY, rebuilt once a day after the same chain (read-only)
    const { startArticlesScheduler } = await import("./lib/articles/scheduler");
    startArticlesScheduler();
    // Smart Segmentation's watcher and nightly sweep, once the hub owns the engine (SEGMENTATION_ENGINE=live)
    const { startSegmentationScheduler } = await import("./lib/segmentation/scheduler");
    startSegmentationScheduler();
    // The morning post: yesterday's price checks to the owner who cares
    // (NOTIFY_SCHEDULER=live)
    const { startNotifyScheduler } = await import("./lib/notify/scheduler");
    startNotifyScheduler();
    // Every look in the shop, kept in the hub's own database before the gateway's
    // 50-line window overwrites it (read-only on HubSpot; SHOP_LOOKS=off stops it)
    const { startShopLooksScheduler } = await import("./lib/shopLooks/scheduler");
    startShopLooksScheduler();
    // Price-check tickets as soon as a day qualifies - the same run as the Create
    // button, every 15 min (PRICE_CHECK_TICKETS=off stops it)
    const { startPriceCheckScheduler } = await import("./lib/datatracker/priceCheckScheduler");
    startPriceCheckScheduler();
    // AVOR is told to pack a leftover as soon as its A-number arrives - the same run as the
    // button on Website > DirectCut > Leftovers (C2S_AVOR_MAIL=off stops it). SARCLA, 18.10.
    const { startAvorScheduler } = await import("./lib/directcut/avorScheduler");
    startAvorScheduler();
    // Connectors & Integration: each Compass step's latest result, remembered (read-only)
    const { startConnectorsWatch } = await import("./lib/connectors/scheduler");
    startConnectorsWatch();
    // The shop's web orders into HubSpot every minute - the Magento connector, moved from
    // APSOAssistant (11.10.2026). Starts in "stage" (reads only) until switched Active.
    const { startMagentoSync } = await import("./lib/connectors/magento/sync");
    startMagentoSync();
    // The Use case pages (lifecycle reports) read in the background, so nobody waits
    // for HubSpot when opening one (read-only; never beside an ERP chain; LIFECYCLE_WARM=off stops it)
    const { startLifecycleWarm } = await import("./lib/lifecycle/scheduler");
    startLifecycleWarm();
    // Lead Generation the same way: read in the background so nobody waits for it (read-only;
    // never beside an ERP chain; LEADS_WARM=off stops it). SARCLA, 19.10.2026.
    const { startLeadsWarm } = await import("./lib/marketingKpis/leadsWarm");
    startLeadsWarm();
    // The 3D Gateway's counts (Railway keeps them in memory only): collected every 15 minutes into the
    // hub's database. Needs THREED_ADMIN_KEY; THREED_COLLECT=off stops it.
    const { startThreeDCollector } = await import("./lib/threeD/calls");
    startThreeDCollector();

    // Ticket associations: the Tickets app's HubSpot workflow, run by the hub every 3 minutes
    // (src/lib/ticketAssoc/run.ts) - starts in preview, writes only once set live on its page.
    // TICKET_ASSOC=off stops it.
    const { startTicketAssoc } = await import("./lib/ticketAssoc/run");
    startTicketAssoc();

    // Stock to partners: each partner's stock file by e-mail at 07:00 Zurich (src/lib/partnerStock),
    // test mode first - only to the test address. PARTNER_STOCK=off stops it.
    const { startPartnerStock } = await import("./lib/partnerStock/engine");
    startPartnerStock();

    // Back Office distribution, SHADOW MODE: what the distribution workflows decide for each new Back Office / GQS
    // ticket, next to what HubSpot did - writes nothing to HubSpot (src/lib/boDistribution). BO_DISTRIBUTION=off stops it.
    const { startBoDistribution } = await import("./lib/boDistribution/engine");
    startBoDistribution();
    // Map assignment, SHADOW until a country is switched live on its page: each company's owner by the rules per country
    // (Performis SAE or postcode zones) next to HubSpot's - every 15 minutes the changed companies, once a night all of
    // them; live countries get owner + region_responsibility + contacts written (src/lib/mapAssign). MAP_ASSIGN=off stops it.
    const { startMapAssign } = await import("./lib/mapAssign/engine");
    startMapAssign();
    // Duplicates & merges: the hub's check by type (the same request twice, the same order, erosion) beside the DUPS
    // workflow's; writes only in Live with the workflow off, and carries out the card's decisions while merging is on
    // (src/lib/ticketDuplicates). TICKET_DUPLICATES=off stops it.
    const { startTicketDuplicates } = await import("./lib/ticketDuplicates/engine");
    startTicketDuplicates();
    // Company duplicates: every company read every hour - the same ERP customer (merged into the oldest only in Live with
    // the COMPANIES FULL DUPLICATE CHECK workflow off), possible duplicates for a person (src/lib/companyDuplicates).
    // COMPANY_DUPLICATES=off stops it. SARCLA, 10.11.2026.
    const { startCompanyDuplicates } = await import("./lib/companyDuplicates/engine");
    startCompanyDuplicates();
    // Ticket value, SHADOW MODE: the workflow SARCLA | TICKET VALUE CALCULATION's rules run by the hub, next to what the
    // workflow writes (src/lib/ticketValue) - writes nothing to HubSpot. TICKET_VALUE=off stops it. SARCLA, 20.10.2026.
    const { startTicketValue } = await import("./lib/ticketValue/engine");
    startTicketValue();

    // APSOassistant Chat > Topics: every real chat filed by topic after it ended, from the whole chat in HubSpot
    // (src/lib/chat/topics.ts, a small Claude model, every 20 min). CHAT_TOPICS=off stops it. SARCLA, 18.10.2026.
    const { startChatTopics } = await import("./lib/chat/topics");
    startChatTopics();

    // Satisfaction: the hub's copy of every HubSpot survey answer, every 30 min (src/lib/satisfaction) - the Satisfaction
    // KPI page and the chat's Satisfaction tab. SATISFACTION=off stops it. SARCLA, 27.10.2026.
    const { startSatisfaction } = await import("./lib/satisfaction/sync");
    startSatisfaction();

    // APSOassistant Chat > Setup: the orchestrator's chat log copied whole into the hub's database, every 5 min, so
    // nothing of the chat lives only on Railway (src/lib/chat/logCopy.ts). CHAT_LOG_COPY=off stops it. SARCLA, 24.10.2026.
    const { startChatLogCopy } = await import("./lib/chat/logCopy");
    startChatLogCopy();

    // Map assignment > Domains: every company without a domain gets its contacts' real one (never a guess from the name),
    // and "private or micro" goes to APSOmicro - replaces the workflow SARCLA | COMPANY SETS DOMAIN; writes only in Live
    // with the workflow switched off (src/lib/companyDomain). COMPANY_DOMAIN=off stops it. SARCLA, 25.10.2026.
    const { startCompanyDomain } = await import("./lib/companyDomain/engine");
    startCompanyDomain();

    // Map assignment > Regions: each company of the eight countries gets the region of its postcode (the official one,
    // else the map's) in "regions" - replaces the workflow SARCLA | REGIONS SET; writes only in Live with the workflow
    // switched off (src/lib/companyRegions). COMPANY_REGIONS=off stops it. SARCLA, 03.11.2026.
    const { startCompanyRegions } = await import("./lib/companyRegions/engine");
    startCompanyRegions();

    // Back Office distribution > GQS > Approvals: each GQS request Sales creates gets its subject, O-number, Sales follow-up
    // ticket and the approval rule (line manager or approved by itself, with the mails) - replaces the workflow SARCLA | GQS
    // Ticket Created by Sales; writes only in Live with the workflow switched off (src/lib/gqsApprovals). GQS_APPROVALS=off
    // stops it. SARCLA, 04.11.2026.
    const { startGqsApprovals } = await import("./lib/gqsApprovals/engine");
    startGqsApprovals();

    // Certificates: the Back Office's certificate requests - AVOR, the Back Office rotation, the conformity experts, the
    // 48 h / 96 h / a week reminders and the 15-day hand-over - replaces the workflow SARCLA | CERTIFICATES NEW PROCESS,
    // switched off 04.11.2026; starts in Preview, writes in Live while the workflow is off (src/lib/certificates).
    // CERTIFICATES=off stops it. SARCLA, 04.11.2026.
    const { startCertificates } = await import("./lib/certificates/engine");
    startCertificates();

    // HubSpot Apps > APSO Translator: every customer message in the inboxes not in English gets a comment in English for the
    // agent, "!" notes translate or reply in the customer's language - the Railway translator brought into the hub
    // (src/lib/translator); starts in Preview. TRANSLATOR=off stops it. SARCLA, 08.11.2026.
    const { startTranslator } = await import("./lib/translator/engine");
    startTranslator();

    // The Enquiry Category at the end of each Back Office ticket left "Others" or empty - the whole conversation, no
    // customer request stays Others, the AI reads the rest; replaces the workflow SARCLA | CLASSIFIER END OF TICKET and
    // writes once that workflow is switched off (src/lib/ticketClose). TICKET_CLOSE=off stops it. SARCLA, 25.10.2026.
    const { startTicketClose } = await import("./lib/ticketClose/engine");
    startTicketClose();

    // Back Office distribution > Detection for any period: every Back Office ticket counted per day - its category today
    // and whether a person re-filed it - so the tiles answer for a year, not only for the e-mails the hub keeps
    // (src/lib/boDetection). Reads HubSpot only. BO_DETECTION=off stops it. SARCLA, 25.10.2026.
    const { startBoDetection } = await import("./lib/boDetection/engine");
    startBoDetection();

    // Map assignment > Phone numbers: a contact with the shop's phone and no phone gets it, in the international form from
    // its country - replaces the workflow SARCLA | Contact phone number correction; writes only in Live with the workflow
    // switched off (src/lib/contactPhone). CONTACT_PHONE=off stops it. SARCLA, 25.10.2026.
    const { startContactPhone } = await import("./lib/contactPhone/engine");
    startContactPhone();

    // HubSpot apps > Personas: each contact's persona from its job and its company - replaces the workflow SARCLA |
    // PERSONAS SET (which never read the company); writes only in Live with the workflow switched off
    // (src/lib/personas). PERSONAS=off stops it. SARCLA, 25.10.2026.
    const { startPersonas } = await import("./lib/personas/engine");
    startPersonas();

    // Website > AI testing & personalization > Pages: the shop's sitemaps on production and ACC, read once a day per
    // environment (src/lib/convert/pages.ts) - read-only against the shop. CONVERT_PAGES=off stops it. SARCLA, 07.11.2026.
    const { startConvertPages } = await import("./lib/convert/pages");
    startConvertPages();

    // AI testing & personalization > Insights: the AI reads the pages losing buyers by itself at night - 5 pages, none
    // while 30 of its ideas wait for a person (src/lib/convert/scan.ts). CONVERT_SCAN=off stops it. SARCLA, 08.11.2026.
    const { startConvertScan } = await import("./lib/convert/scan");
    startConvertScan();
  }
}
