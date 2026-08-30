// Lightweight liveness endpoint for the Application Load Balancer target-group
// health check. Returns 200 without touching the database, so a healthy
// container is reported ready even before any request hits the app.
// (The home page "/" redirects to login, which is a poor health signal.)
//
// It also names the build it is running. That is the only way to tell
// "redeployed but nothing changed" apart from "the service never moved off
// the previous task-definition revision".
export const dynamic = "force-dynamic";

export function GET() {
  const commit = process.env.APP_COMMIT ?? "unknown";
  return Response.json(
    {
      status: "ok",
      commit,
      shortCommit: commit === "unknown" ? "unknown" : commit.slice(0, 7),
      builtAt: process.env.APP_BUILT_AT ?? "unknown",
    },
    { status: 200 },
  );
}
