import type { Metadata } from "next";
import Box from "@mui/material/Box";
import ThemeRegistry from "./ThemeRegistry";
import Sidebar, { DRAWER_WIDTH } from "./Sidebar";

export const metadata: Metadata = {
  title: "APSO Marketing Hub",
  description: "Marketing content generation for LinkedIn & Newsletters",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <Box sx={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar />
            <Box
              component="main"
              sx={{
                flexGrow: 1,
                bgcolor: "background.default",
                p: 4,
                ml: `${DRAWER_WIDTH}px`,
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
