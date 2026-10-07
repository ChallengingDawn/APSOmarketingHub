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
    // Connectors & Integration: each Compass step's latest result, remembered (read-only)
    const { startConnectorsWatch } = await import("./lib/connectors/scheduler");
    startConnectorsWatch();
  }
}
