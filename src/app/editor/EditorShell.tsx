"use client";

/**
 * THE CANVAS PAGE.
 *
 * It used to be a 26px title, a sentence of explanation, two buttons and the
 * canvas — inside the hub's 300px drawer. So the page people spend the longest
 * on was the one with no way to anything: not the project it belongs to, not
 * the piece beside it, not the page before it.
 *
 * The window is now four columns and a title bar: the hub at 48px, the work
 * rail, the stage, and ONE inspector. The canvas's document bar, its selection
 * bar and its tools all render in that inspector, so the stage holds nothing
 * but the artboard — three surfaces for one selection was the confusion.
 * (SARCLA, 18.10.2026)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";

import type { ContentItem } from "@/lib/content";
import type { DesignDocument } from "@/lib/design-document";
import CanvasTopBar from "./CanvasTopBar";
import WorkRail from "./WorkRail";
import { CanvasStatusBar, GROUND, HubRail, INSP_W, LINE } from "./canvasChrome";

// Konva touches `window` at import time — client-only.
const EditorCanvas = dynamic(() => import("./EditorCanvas"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
      <CircularProgress size={30} />
    </Box>
  ),
});

type Sibling = { id: number; title: string | null; label: string | null; status: string };

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

  const [project, setProject] = useState<{ id: number; title: string } | null>(null);
  const [siblings, setSiblings] = useState<Sibling[]>([]);

  const [pages, setPages] = useState<DesignDocument[]>([]);
  const [activePage, setActivePage] = useState(0);
  const [revision, setRevision] = useState<number | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);

  /**
   * The live document, held in a ref.
   *
   * The canvas reads `initialDocument` once, in a useState initialiser, so the
   * only way to put a different page on it is to remount it — and a remount
   * throws away whatever was not saved. Holding the document here means the
   * page being left can be put back in the list first. In a ref rather than
   * state so an edit on the canvas does not re-render this whole tree.
   */
  const liveDoc = useRef<DesignDocument | null>(null);
  /** Likewise, so saving the page list never restarts the effect that saves it. */
  const revisionRef = useRef<number>(1);
  useEffect(() => { if (revision) revisionRef.current = revision; }, [revision]);

  /* the inspector's three hosts, in the order they stack */
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);
  const [selectionHost, setSelectionHost] = useState<HTMLElement | null>(null);
  const [toolsHost, setToolsHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!itemId) return;
    const controller = new AbortController();
    setLoadingItem(true); setError(""); setItem(null);
    fetch(`/api/content/${itemId}`, { signal: controller.signal })
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error ?? "Unable to load design"); return data; })
      .then((d) => {
        if (controller.signal.aborted) return;
        setItem(d.item);
        setRevision(d.item?.revision ?? null);
        revisionRef.current = d.item?.revision ?? 1;
        // A piece made before pages existed reads as one page, and it is the
        // design document.
        const got: DesignDocument[] = d.item?.pages?.length
          ? d.item.pages
          : d.item?.designDocument
            ? [d.item.designDocument]
            : [];
        setPages(got);
        setActivePage(0);
        liveDoc.current = got[0] ?? null;
      })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load design"); })
      .finally(() => { if (!controller.signal.aborted) setLoadingItem(false); });
    return () => controller.abort();
  }, [itemId]);

  // The project and its other pieces: fetched once here and shared with the
  // title bar and the work rail, rather than once each.
  const projectId = item?.projectId ?? null;
  useEffect(() => {
    if (!projectId) { setProject(null); setSiblings([]); return; }
    const ac = new AbortController();
    fetch(`/api/content/projects/${projectId}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        if (ac.signal.aborted || !d?.ok) return;
        setProject({ id: d.project.id, title: d.project.title });
        setSiblings(d.variants ?? []);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [projectId]);

  /**
   * Write the page list onto the piece.
   *
   * Called from the page operations rather than from an effect on `pages`: an
   * effect would re-run on the revision this very call returns, and save in a
   * loop. The canvas keeps saving the artboard on its own schedule; this saves
   * the ORDER, which is the part a reload would otherwise lose.
   */
  const persistPages = useCallback(async (next: DesignDocument[]) => {
    if (!itemId || next.length === 0) return;
    try {
      const r = await fetch(`/api/content/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: revisionRef.current, pages: next }),
      });
      const d = await r.json();
      if (r.ok && d?.item) { revisionRef.current = d.item.revision; setRevision(d.item.revision); }
    } catch {
      /* the list is still right on screen; the next save carries it */
    }
  }, [itemId]);

  /** The page being left goes back in the list before anything moves. */
  const capture = useCallback((cur: DesignDocument[]) => {
    const live = liveDoc.current;
    if (!live || cur.length === 0) return cur;
    const next = cur.slice();
    next[activePage] = live;
    return next;
  }, [activePage]);

  const selectPage = useCallback((i: number) => {
    if (i === activePage || i < 0 || i >= pages.length) return;
    const kept = capture(pages);
    setPages(kept);
    setActivePage(i);
    liveDoc.current = kept[i] ?? null;
  }, [activePage, pages, capture]);

  const addPage = useCallback(() => {
    const base = liveDoc.current ?? pages[activePage] ?? item?.designDocument;
    if (!base) return;
    // A new page inherits the artboard and the background, not the content:
    // same size and colour, nothing to delete before you start.
    const blank: DesignDocument = { ...base, nodes: [] };
    const kept = capture(pages.length ? pages : [base]);
    const next = [...kept, blank];
    setPages(next);
    setActivePage(next.length - 1);
    liveDoc.current = blank;
    void persistPages(next);
  }, [pages, activePage, item?.designDocument, capture, persistPages]);

  const duplicatePage = useCallback((i: number) => {
    const kept = capture(pages);
    if (kept.length === 0) return;
    const copy = JSON.parse(JSON.stringify(kept[i])) as DesignDocument;
    // Ids must be unique across the document or the schema refuses it.
    copy.nodes = copy.nodes.map((n, k) => ({ ...n, id: `${n.id}-c${Date.now().toString(36)}${k}` }));
    const next = [...kept.slice(0, i + 1), copy, ...kept.slice(i + 1)];
    setPages(next);
    setActivePage(i + 1);
    liveDoc.current = copy;
    void persistPages(next);
  }, [pages, capture, persistPages]);

  const deletePage = useCallback((i: number) => {
    const kept = capture(pages);
    if (kept.length <= 1) return;
    const next = kept.filter((_, k) => k !== i);
    const to = Math.max(0, Math.min(i, next.length - 1));
    setPages(next);
    setActivePage(to);
    liveDoc.current = next[to] ?? null;
    void persistPages(next);
  }, [pages, capture, persistPages]);

  const movePage = useCallback((i: number, dir: -1 | 1) => {
    const kept = capture(pages);
    const j = i + dir;
    if (j < 0 || j >= kept.length) return;
    const next = kept.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setPages(next);
    setActivePage(j);
    liveDoc.current = next[j] ?? null;
    void persistPages(next);
  }, [pages, capture, persistPages]);

  const title = item?.title?.trim() || (itemId ? `Design #${itemId}` : "New design");

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "#fff", overflow: "hidden" }}>
      <CanvasTopBar
        itemId={itemId}
        itemTitle={title}
        project={project}
        siblings={siblings}
        projectId={projectId}
        pages={pages.length}
        activePage={activePage}
        onSelectPage={selectPage}
        revision={revision}
      />

      <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
        <HubRail />
        <WorkRail
          pages={pages}
          activePage={activePage}
          onSelectPage={selectPage}
          onAddPage={itemId ? addPage : undefined}
          onDuplicatePage={itemId ? duplicatePage : undefined}
          onDeletePage={itemId ? deletePage : undefined}
          onMovePage={itemId ? movePage : undefined}
          siblings={siblings}
          itemId={itemId}
          project={project}
        />

        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", bgcolor: GROUND }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {loadingItem ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
                <CircularProgress size={30} />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>
            ) : (
              <EditorCanvas
                // The page is part of the identity: without it the canvas keeps
                // the document it mounted with and the rail changes nothing.
                key={`${itemId ?? "new"}-${activePage}`}
                itemId={itemId}
                initialImage={item?.imageUrl}
                initialDocument={pages[activePage] ?? item?.designDocument}
                initialRevision={item?.revision}
                initialTemplateId={templateId}
                chromeHosts={{ actions: actionsHost, selection: selectionHost }}
                toolsContainer={toolsHost}
                fillHeight
                onCanvasSize={setCanvasSize}
                onDocumentChange={(d) => { liveDoc.current = d; }}
                onSaved={(rev, doc) => {
                  setRevision(rev);
                  revisionRef.current = rev;
                  liveDoc.current = doc;
                  setPages((cur) => {
                    if (cur.length === 0) return [doc];
                    const next = cur.slice();
                    next[activePage] = doc;
                    return next;
                  });
                }}
              />
            )}
          </Box>
          <CanvasStatusBar
            pageCount={pages.length}
            activePage={activePage}
            onSelectPage={selectPage}
            size={canvasSize}
            typeLabel={item?.channel ? item.channel : "Design"}
          />
        </Box>

        {/* ONE column for everything that changes the design: the document's
            own bar, the selection's bar, then the tools. */}
        <Box sx={{
          width: INSP_W, flexShrink: 0, bgcolor: "#fff", borderLeft: `1px solid ${LINE}`,
          overflowY: "auto", px: 1.5, py: 1.5,
        }}>
          <Box ref={setActionsHost} />
          <Box ref={setSelectionHost} />
          <Box ref={setToolsHost} />
        </Box>
      </Box>
    </Box>
  );
}
