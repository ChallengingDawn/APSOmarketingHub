// Lightweight liveness endpoint for the Application Load Balancer target-group
// health check. Returns 200 without touching the database, so a healthy
// container is reported ready even before any request hits the app.
// (The home page "/" redirects to login, which is a poor health signal.)
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}
