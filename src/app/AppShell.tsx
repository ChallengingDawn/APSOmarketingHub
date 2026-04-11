"use client";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Sidebar, { DRAWER_WIDTH } from "./Sidebar";

/**
 * AppShell — client wrapper that decides whether to show the sidebar.
 * Pages under /signin render full-screen without the sidebar chrome.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/signin");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f0f2f5" }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          ml: `${DRAWER_WIDTH}px`,
          maxWidth: `calc(100vw - ${DRAWER_WIDTH}px)`,
          overflow: "auto",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
