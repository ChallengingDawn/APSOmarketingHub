"use client";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Sidebar from "./Sidebar";
import Phase2Gate from "./Phase2Gate";

const PHASE_1_PATHS = ["/personality", "/content-generation", "/logs"];

function isPhase1(pathname: string) {
  return PHASE_1_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isDocs(pathname: string) {
  return pathname.startsWith("/docs");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isAuthRoute = pathname.startsWith("/signin");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  const allowDirect = isPhase1(pathname) || isDocs(pathname);
  const isFullBleed = pathname === "/personality";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f0f2f5" }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: isFullBleed ? 0 : allowDirect ? 2 : 0,
          overflow: isFullBleed ? "hidden" : "auto",
          height: isFullBleed ? "100vh" : "auto",
        }}
      >
        {allowDirect ? children : <Phase2Gate>{children}</Phase2Gate>}
      </Box>
    </Box>
  );
}
