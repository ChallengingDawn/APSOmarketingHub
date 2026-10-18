// Runs once when a server process starts (Next.js instrumentation hook).
//
// Only the Node runtime: the DoC timer needs Postgres, SMTP and node:https. Keep
// the import INSIDE this exact `if` - Next compiles the hook for the edge runtime
// too, and only this form lets the compiler drop pg from that bundle (an early
// `return` does not, and the build fails on 'fs' and 'path').
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
  }
}
