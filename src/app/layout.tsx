import type { Metadata } from "next";
import Box from "@mui/material/Box";
import ThemeRegistry from "./ThemeRegistry";
import Sidebar, { DRAWER_WIDTH } from "./Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "APSO Marketing Hub | Mission Control",
  description: "AI-powered marketing operations platform for APSOparts — SEO, content generation, and digital growth management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
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
        </ThemeRegistry>
      </body>
    </html>
  );
}
