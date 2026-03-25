"use client";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Box from "@mui/material/Box";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import FolderIcon from "@mui/icons-material/Folder";
import Link from "next/link";

const cards = [
  {
    title: "LinkedIn Posts",
    description: "Generate and schedule LinkedIn content for Angst+Pfister pages.",
    href: "/linkedin",
    icon: <LinkedInIcon sx={{ fontSize: 32 }} />,
    color: "primary.main",
  },
  {
    title: "Newsletter",
    description: "Create and manage Drive newsletter content for distribution.",
    href: "/newsletter",
    icon: <NewspaperIcon sx={{ fontSize: 32 }} />,
    color: "secondary.main",
  },
  {
    title: "Content Base",
    description: "Manage reusable content blocks, templates, and brand assets.",
    href: "/content",
    icon: <FolderIcon sx={{ fontSize: 32 }} />,
    color: "primary.light",
  },
];

export default function Dashboard() {
  return (
    <>
      <Typography variant="h5" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Your Innovation Development Partner
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ flexWrap: "wrap" }}>
        {cards.map((card) => (
          <Card key={card.href} variant="outlined" sx={{ flex: "1 1 280px", maxWidth: 360 }}>
            <CardActionArea component={Link} href={card.href} sx={{ p: 1 }}>
              <CardContent>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: card.color,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 2,
                  }}
                >
                  {card.icon}
                </Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  {card.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.description}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </>
  );
}
