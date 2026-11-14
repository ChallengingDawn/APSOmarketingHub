"use client";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Sidebar from "./Sidebar";
import MeshBackground, { MESH_BASE } from "./MeshBackground";
import { ViewAsProvider } from "./ViewAs";
import { ReportingWindowProvider } from "./window/ReportingWindow";
import SandboxBar from "./SandboxBar";
import PathGuard from "./PathGuard";
import { SANDBOX_BASE } from "./SandboxMode";

/**
 * Routes whose page owns its own outer spacing get the shell's default padding;
 * everything else lays out edge-to-edge. Purely a layout concern — unrelated to
 * whether a route reads live data.
 */
const PADDED_PATHS = [
  "/personality",
  "/personas",
  "/content-generation",
  "/photos",
  "/templates",
  "/settings",
  "/admin",
  "/library",
  "/create",
  "/editor",
  // the PricingHub's pages keep the spacing they had there (its shell padded every page)
  "/pricing",
];


function matchPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPadded(pathname: string) {
  return PADDED_PATHS.some((p) => matchPrefix(pathname, p)) || pathname.startsWith("/docs");
}

/** `sandbox`: this copy is the Railway sandbox (the layout reads APSOHUB_SANDBOX) - every page gets its bar on top. */
export default function AppShell({ children, sandbox = false }: { children: React.ReactNode; sandbox?: boolean }) {
  const pathname = usePathname() || "/";
  const surface = sandbox ? SANDBOX_BASE : MESH_BASE;
  const isAuthRoute =
    pathname.startsWith("/signin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/enroll") ||
    pathname.startsWith("/change-password") ||
    pathname.startsWith("/signup") ||
    // An invited person has no account to navigate with yet, so no shell.
    pathname.startsWith("/invite");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  // The home screen carries NO navigation. That is the whole constraint: a
  // front door with nowhere to sprawl to cannot grow a thicket of links, and
  // the menu you get after one click is only that app's.
  const isLaunchPad = pathname === "/";
  if (isLaunchPad) {
    return (
      <ViewAsProvider>
        <Box sx={{ minHeight: "100vh", bgcolor: surface }}>
          {sandbox && <SandboxBar />}
          <ReportingWindowProvider>{children}</ReportingWindowProvider>
        </Box>
      </ViewAsProvider>
    );
  }

  // Pricing's printable report (Prices · Trends · Stock > Report): the paper alone, no panel - it is printed or saved as PDF
  const isPricingReport = pathname === "/pricing/prices/report";
  const padded = isPadded(pathname) && !isPricingReport;
  // The canvas page runs the window itself: its own 48px app rail, title bar,
  // work rail and inspector. A 300px drawer beside all that is the hub's
  // navigation sitting on top of the work's own (SARCLA, 18.10.2026).
  // a to-do's studio runs the whole window too, its own bar on top (08.11.2026)
  const isCanvas = matchPrefix(pathname, "/editor") || /^\/projects\/\d+\/pieces\/\d+/.test(pathname ?? "");
  const isFullBleed = pathname === "/personality" || isCanvas;
  // The action plan is an application of its own and wants the whole width for its Gantt (SARCLA 01.11.2026: "full
  // width to see everything"; "its own application, different from the others"): no panel, the hub's bar on top.
  const isPlan = matchPrefix(pathname, "/action-plan");
  // a graph's Actions page (Advanced reporting's action creation module) is three parts side by side - the plan's table,
  // the graph, its target: the whole width, the hub's bar on top, Back to the report it came from (SARCLA 04.11.2026)
  const isKpiActions = matchPrefix(pathname, "/reporting/actions");
  // the Angst+Pfister hub (SARCLA 10.11.2026) is a hub of its own: the APSOparts apps' panel is not its menu - its bar
  // on top carries Home and the switch between the two hubs
  const isApHub = matchPrefix(pathname, "/ap");

  return (
    // The same mesh as the front page. One surface rather than a colourful
    // door onto a grey room — and the frosted panels on top need something to
    // be glass over.
    <ViewAsProvider>
    {/* a phone (< 900 px): the panel folds into a bar on top (Sidebar.tsx) - the page gets the whole width */}
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: "100vh", bgcolor: surface, position: "relative" }}>
      {/* Quiet here: an app screen is mostly empty below its content, so the
          wash would be the whole lower half of the window at full strength. */}
      <MeshBackground strength="quiet" />
      {/* Advanced reporting's front page is a door like the launch pad: no
          panel until you are in a category or a report (SARCLA, 11.10.2026); Website's the same since it has
          sections (SARCLA 03.11.2026), UC & HubSpot Apps' and Marketing & Content's too. */}
      {pathname !== "/reporting" && pathname !== "/website" && pathname !== "/uc" && pathname !== "/marketing" && !isCanvas && !isPlan && !isKpiActions && !isApHub && !isPricingReport && <Sidebar />}
      {/* the Angst+Pfister hub's reports carry its own panel, laid out like Advanced reporting's (SARCLA 10.11.2026: "the
          layout should follow our advanced reports"); its front page and its Settings keep the bar on top */}
      {isApHub && matchPrefix(pathname, "/ap/reporting") && <Sidebar hub="ap" />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          position: "relative",
          zIndex: 1,
          p: isFullBleed ? 0 : padded ? 2 : 0,
          overflow: isFullBleed ? "hidden" : "auto",
          height: isFullBleed ? "100vh" : "auto",
        }}
      >
        {sandbox && <SandboxBar />}
        <ReportingWindowProvider>{sandbox ? children : <PathGuard>{children}</PathGuard>}</ReportingWindowProvider>
      </Box>
    </Box>
    </ViewAsProvider>
  );
}
