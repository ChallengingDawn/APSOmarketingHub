"use client";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Sidebar from "./Sidebar";
import RightRail from "./RightRail";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/signin");
  const hideRail =
    pathname?.startsWith("/content-generation") || pathname?.startsWith("/personality");

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
          minWidth: 0,
          p: 2,
          overflow: "auto",
        }}
      >
        {children}
      </Box>
      {!hideRail && <RightRail />}
    </Box>
  );
}
