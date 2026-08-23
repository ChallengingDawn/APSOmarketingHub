"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Link from "next/link";

// Konva touches `window` at import time — client-only.
const EditorCanvas = dynamic(() => import("./EditorCanvas"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
      <CircularProgress size={30} />
    </Box>
  ),
});

export default function EditorShell({
  itemIdRaw,
  templateId,
}: {
  itemIdRaw?: string;
  templateId?: string;
}) {
  const itemId = itemIdRaw && /^\d+$/.test(itemIdRaw) ? Number(itemIdRaw) : undefined;
  const [image, setImage] = useState<string | null>(null);
  const [loadingItem, setLoadingItem] = useState(Boolean(itemId));

  useEffect(() => {
    if (!itemId) return;
    fetch(`/api/content/${itemId}`)
      .then((r) => r.json())
      .then((d) => setImage(d.item?.imageUrl ?? null))
      .catch(() => {})
      .finally(() => setLoadingItem(false));
  }, [itemId]);

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography sx={{ fontFamily: "var(--font-outfit)", fontSize: 26, fontWeight: 700, color: "#1a1d21", letterSpacing: "-0.02em" }}>
            Visual Editor
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#5b6470" }}>
            Layer brand text and badges over generated images — templates included, everything exports as PNG.
            {itemId ? ` Editing the image of draft #${itemId}.` : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button component={Link} href="/create" startIcon={<AutoAwesomeIcon />} sx={{ fontWeight: 600, color: "#ed1b2f" }}>
            Create Studio
          </Button>
          <Button component={Link} href="/library" startIcon={<LibraryBooksIcon />} sx={{ fontWeight: 600, color: "#274e64" }}>
            Library
          </Button>
        </Box>
      </Box>
      {loadingItem ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress size={30} />
        </Box>
      ) : (
        <EditorCanvas itemId={itemId} initialImage={image} initialTemplateId={templateId} />
      )}
    </Box>
  );
}
