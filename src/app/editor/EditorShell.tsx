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
import Alert from "@mui/material/Alert";
import type { ContentItem } from "@/lib/content";

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
  const [item, setItem] = useState<ContentItem | null>(null);
  const [error, setError] = useState("");
  const [loadingItem, setLoadingItem] = useState(Boolean(itemId));

  useEffect(() => {
    if (!itemId) return;
    const controller = new AbortController();
    setLoadingItem(true); setError(""); setItem(null);
    fetch(`/api/content/${itemId}`, { signal: controller.signal })
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error ?? "Unable to load design"); return data; })
      .then((d) => { if (!controller.signal.aborted) setItem(d.item); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load design"); })
      .finally(() => { if (!controller.signal.aborted) setLoadingItem(false); });
    return () => controller.abort();
  }, [itemId]);

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography sx={{ fontFamily: "var(--font-outfit)", fontSize: 26, fontWeight: 700, color: "#1a1d21", letterSpacing: "-0.02em" }}>
            Visual Editor
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#5b6470" }}>
            Create editable designs, save them to the shared Library, and hand them to a teammate.
            {itemId ? ` Piece #${itemId}.` : ""}
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
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <EditorCanvas key={itemId ?? "new"} itemId={itemId} initialImage={item?.imageUrl}
          initialDocument={item?.designDocument} initialRevision={item?.revision}
          initialTemplateId={templateId} />
      )}
    </Box>
  );
}
