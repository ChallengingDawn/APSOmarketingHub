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
  }
}
