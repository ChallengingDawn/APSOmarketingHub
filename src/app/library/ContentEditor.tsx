"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import MarkdownPreview from "@/app/create/MarkdownPreview";
import type { ContentItem } from "./contentMeta";

type HistoryEntry = { revision: number; title: string | null; status: string; replaced_by: string; replaced_at: string };

export default function ContentEditor({ item, onSaved, onEditing }: {
  item: ContentItem; onSaved: (item: ContentItem) => void; onEditing: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [baseRevision, setBaseRevision] = useState(item.revision);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing]);

  const begin = () => {
    setTitle(item.title ?? ""); setBody(item.body); setBaseRevision(item.revision);
    setEditing(true); onEditing(true); setError(""); setMessage("");
  };
  const cancel = () => {
    if ((body !== item.body || title !== (item.title ?? "")) && !window.confirm("Discard your unsaved text changes?")) return;
    setEditing(false); onEditing(false); setError("");
  };
  const save = async () => {
    if (saving || !body.trim()) return;
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/content/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || null, body, expectedRevision: baseRevision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Saving failed");
      onSaved(data.item); setEditing(false); onEditing(false); setHistory(null);
      setMessage(`Saved as version ${data.item.revision}. Edited content needs fresh approval.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Saving failed. Your edits are still here."); }
    finally { setSaving(false); }
  };
  const showHistory = async () => {
    if (history) { setHistory(null); return; }
    setLoadingHistory(true); setError("");
    try {
      const res = await fetch(`/api/content/${item.id}/history`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load history");
      setHistory(data.history);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load history"); }
    finally { setLoadingHistory(false); }
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/library?item=${item.id}`);
      setMessage("Link copied. Teammates need an active Hub account to open it.");
    } catch { setError("Could not copy the link. Copy this page's address instead."); }
  };

  return <Box sx={{ mb: 2.5 }}>
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
    {message && <Alert severity="success" onClose={() => setMessage("")} sx={{ mb: 1 }}>{message}</Alert>}
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
      {!editing && <Button variant="contained" onClick={begin}>Edit text</Button>}
      <Button onClick={share}>Share with teammate</Button>
      <Button onClick={showHistory} disabled={loadingHistory}>{loadingHistory ? "Loading…" : "Version history"}</Button>
    </Box>
    {editing ? <Box sx={{ display: "grid", gap: 1.5 }}>
      <Typography variant="caption">Editing version {baseRevision}. Markdown headings, lists and bold text are supported.</Typography>
      <TextField label="Title" fullWidth value={title} disabled={saving} inputProps={{ maxLength: 300 }} onChange={(e) => setTitle(e.target.value)} />
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button onClick={() => setPreview(false)} variant={!preview ? "outlined" : "text"}>Write</Button>
        <Button onClick={() => setPreview(true)} variant={preview ? "outlined" : "text"}>Preview</Button>
      </Box>
      {preview ? <Box sx={{ p: 2, border: "1px solid #e3e6ea", borderRadius: 2 }}><MarkdownPreview text={body} /></Box>
        : <TextField label="Content" fullWidth multiline minRows={12} maxRows={28} value={body} disabled={saving}
            inputProps={{ maxLength: 200000 }} onChange={(e) => setBody(e.target.value)} />}
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button variant="contained" onClick={save} disabled={saving || !body.trim()}>{saving ? <CircularProgress size={18} /> : "Save text"}</Button>
        <Button onClick={cancel} disabled={saving}>Cancel</Button>
      </Box>
    </Box> : <Box sx={{ border: "1px solid #e3e6ea", borderRadius: 2, p: 2 }}><MarkdownPreview text={item.body} /></Box>}
    {history && <Box sx={{ mt: 2, p: 2, bgcolor: "#f5f6f8", borderRadius: 2 }}>
      <Typography variant="subtitle2">Current version {item.revision}</Typography>
      {history.length === 0 && <Typography variant="body2">No previous versions yet.</Typography>}
      {history.map((entry) => <Typography key={entry.revision} variant="body2" sx={{ mt: 1 }}>
        Version {entry.revision} · {entry.status} · replaced by {entry.replaced_by} on {new Date(entry.replaced_at).toLocaleString()}
      </Typography>)}
    </Box>}
  </Box>;
}
