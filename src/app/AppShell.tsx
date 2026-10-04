"use client";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Sidebar from "./Sidebar";
import MeshBackground, { MESH_BASE } from "./MeshBackground";
import { ViewAsProvider } from "./ViewAs";
import { ReportingWindowProvider } from "./window/ReportingWindow";

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
  "/logs",
  "/library",
  "/create",
  "/editor",
];


function matchPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPadded(pathname: string) {
  return PADDED_PATHS.some((p) => matchPrefix(pathname, p)) || pathname.startsWith("/docs");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isAuthRoute =
    pathname.startsWith("/signin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/enroll") ||
    pathname.startsWith("/change-password");

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
        <Box sx={{ minHeight: "100vh", bgcolor: MESH_BASE }}>
          <ReportingWindowProvider>{children}</ReportingWindowProvider>
        </Box>
      </ViewAsProvider>
    );
  }

  const padded = isPadded(pathname);
  const isFullBleed = pathname === "/personality";

  return (
    // The same mesh as the front page. One surface rather than a colourful
    // door onto a grey room — and the frosted panels on top need something to
    // be glass over.
    <ViewAsProvider>
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: MESH_BASE, position: "relative" }}>
      {/* Quiet here: an app screen is mostly empty below its content, so the
          wash would be the whole lower half of the window at full strength. */}
      <MeshBackground strength="quiet" />
      <Sidebar />
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
        <ReportingWindowProvider>{children}</ReportingWindowProvider>
      </Box>
    </Box>
    </ViewAsProvider>
  );
}
