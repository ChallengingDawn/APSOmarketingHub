"use client";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Sidebar from "./Sidebar";

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

  const padded = isPadded(pathname);
  const isFullBleed = pathname === "/personality";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f5f6f8" }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: isFullBleed ? 0 : padded ? 2 : 0,
          overflow: isFullBleed ? "hidden" : "auto",
          height: isFullBleed ? "100vh" : "auto",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
