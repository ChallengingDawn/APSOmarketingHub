"use client";
import React, { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import { aoaSheet, downloadXlsx, type Cell } from "@/lib/pricing/xlsx";
import PageHeader from "../../PageHeader";
import { firewallMessage, refusedByFirewall } from "../../upload";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";
const RED = "#c8463a", MUTED = "#5d6b85", NAVY = "#274e64";

type Row = {
  code: string | null; brand: string; material: string; form: string;
  dimText: string; dimMin: number | null; dimMax: number | null; price: number | null;
};
type Result = {
  supplier: string; customerNo: string | null; currency: string; priceBasis: string;
  validFrom: string | null; rowCount: number; rows: Row[];
};

const FORM_COLOR: Record<string, string> = {
  rod: "#e7f0fb", plate: "#fdf0df", tube: "#e8f5e9", sheet: "#f3e8fd", other: "#eef2f8",
};

export default function OcrMappingPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [ingest, setIngest] = useState<{ supplier: string; ingested: number } | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);

  const onXlsx = async (file: File) => {
    setErr(""); setIngest(null); setIngesting(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read the file."));
        r.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] ?? "";
      const resp = await fetch(`${API_URL}/api/purchasing/ingest-xlsx`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, data: base64 }),
      });
      if (refusedByFirewall(resp)) { setErr(firewallMessage("/purchasing/ocr")); return; }
      const j = await resp.json();
      if (!resp.ok) { setErr(j?.error || `Excel ingest failed (${resp.status}).`); return; }
      setIngest(j as { supplier: string; ingested: number });
    } catch (e) { setErr((e as Error).message || "Couldn't read that Excel."); }
    finally { setIngesting(false); }
  };

  const onFile = async (file: File) => {
    setErr(""); setRes(null); setBusy(true); setFileName(file.name);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read the file."));
        r.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] ?? "";
      const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
      const resp = await fetch(`${API_URL}/api/purchasing/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType, data: base64 }),
      });
      if (refusedByFirewall(resp)) { setErr(firewallMessage("/purchasing/ocr")); return; }
      const j = await resp.json();
      if (!resp.ok) { setErr(j?.error || `OCR failed (${resp.status}).`); return; }
      setRes(j as Result);
    } catch (e) {
      setErr((e as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const exportRows = async () => {
    if (!res) return;
    const head = ["Supplier code", "Brand / variant", "Material", "Form", "Dim min [mm]", "Dim max [mm]", "Dimension text", `Price ${res.currency}/${res.priceBasis}`];
    const body = res.rows.map(r => [r.code ?? "", r.brand, r.material, r.form, r.dimMin ?? "", r.dimMax ?? "", r.dimText, r.price ?? ""]);
    await downloadXlsx(`${(res.supplier || "supplier").replace(/\s+/g, "_")}_price-list-OCR.xlsx`, [aoaSheet("Price list (OCR)", [head, ...body] as Cell[][])]);
  };

  return (
    <Box>
      <PageHeader icon="ocr" eyebrow="Purchasing" title="OCR & Mapping"
        subtitle="Read a supplier price-list PDF into structured rows. Verify the columns, then it feeds the Benchmarking Table and the purchase cost (GWStdP)."
        rightSlot={res ? <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportRows} sx={{ bgcolor: NAVY, fontWeight: 800, textTransform: "none", "&:hover": { bgcolor: "#1d3a4a" } }}>Export rows</Button> : undefined} />

      {/* upload */}
      <Card sx={{ border: "1px dashed #cfd5db", borderRadius: 3, p: 3, mb: 2.5, textAlign: "center", bgcolor: "#fafbfc" }}>
        <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,.pdf" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#15223a", mb: 0.5 }}>Upload a supplier price list</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 2 }}>PDF or image. The extractor reads every priced line (supplier code · material · form · dimension · price).</Typography>
        <Button variant="contained" startIcon={<UploadFileIcon />} disabled={busy} onClick={() => inputRef.current?.click()}
          sx={{ bgcolor: RED, fontWeight: 800, textTransform: "none", "&:hover": { bgcolor: "#d81528" } }}>
          {busy ? "Reading…" : "Choose file"}
        </Button>
        {fileName && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 1.5 }}>{fileName}</Typography>}
        {busy && <Box sx={{ mt: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
          <CircularProgress size={18} sx={{ color: RED }} />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Extracting with Claude vision — a multi-page list takes ~20–40s…</Typography>
        </Box>}
      </Card>

      {/* structured Excel ingest — powers the Benchmark 1-to-1 */}
      <Card sx={{ border: "1px solid #cfe3d6", borderRadius: 3, p: 3, mb: 2.5, textAlign: "center", bgcolor: "#f5fbf7" }}>
        <input ref={xlsxRef} type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onXlsx(f); }} />
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#15223a", mb: 0.5 }}>Load the supplier price-list Excel (Table sheet)</Typography>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 2 }}>This is the article master that powers the <b>Benchmarking Table</b> 1-to-1 (A+P article ↔ supplier, net weight, list price, GWStdP, deviation).</Typography>
        <Button variant="contained" startIcon={<UploadFileIcon />} disabled={ingesting} onClick={() => xlsxRef.current?.click()}
          sx={{ bgcolor: "#1e8e3e", fontWeight: 800, textTransform: "none", "&:hover": { bgcolor: "#176c2f" } }}>
          {ingesting ? "Ingesting…" : "Choose Excel"}
        </Button>
        {ingest && <Typography sx={{ fontSize: "0.84rem", color: "#1e7e45", fontWeight: 700, mt: 1.5 }}>✓ Ingested {ingest.ingested} articles for {ingest.supplier} — open the Benchmarking Table.</Typography>}
        {ingesting && <Box sx={{ mt: 1.5 }}><CircularProgress size={16} sx={{ color: "#1e8e3e" }} /></Box>}
      </Card>

      {err && (
        <Card sx={{ border: "1px solid #f3c9ce", borderRadius: 2.5, p: 2, mb: 2.5, bgcolor: "#fdecee" }}>
          <Typography sx={{ fontSize: "0.85rem", color: "#a01622", fontWeight: 600 }}>{err}</Typography>
          {err.includes("ANTHROPIC_API_KEY") && (
            <Typography sx={{ fontSize: "0.78rem", color: "#a01622", mt: 0.5 }}>
              Add <b>ANTHROPIC_API_KEY</b> to the backend service on Railway (same key as apsoexpenses works), then retry.
            </Typography>
          )}
        </Card>
      )}

      {res && (
        <>
          {/* meta */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.5, alignItems: "center" }}>
            {res.supplier && <Chip label={res.supplier} sx={{ fontWeight: 700, bgcolor: "#eef2f6", color: NAVY }} />}
            {res.customerNo && <Chip size="small" label={`Customer ${res.customerNo}`} sx={{ bgcolor: "#eef2f8", color: MUTED }} />}
            {res.validFrom && <Chip size="small" label={`Valid from ${res.validFrom}`} sx={{ bgcolor: "#eef2f8", color: MUTED }} />}
            <Chip size="small" label={`Prices in ${res.currency}/${res.priceBasis}`} sx={{ bgcolor: "#e8f5e9", color: "#2e7d32", fontWeight: 600 }} />
            <Box sx={{ flex: 1 }} />
            <Chip label={`${res.rowCount.toLocaleString()} rows`} size="small" sx={{ fontWeight: 700, bgcolor: "#fdecee", color: RED }} />
          </Box>

          <Card sx={{ border: "1px solid #e4e9f1", borderRadius: 2.5 }}>
            <TableContainer sx={{ maxHeight: 640 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.68rem", color: MUTED, textTransform: "uppercase", letterSpacing: 0.3, bgcolor: "#f7f8fa", whiteSpace: "nowrap" } }}>
                    <TableCell>Supplier code</TableCell>
                    <TableCell>Brand / variant</TableCell>
                    <TableCell>Material</TableCell>
                    <TableCell>Form</TableCell>
                    <TableCell>Dimension</TableCell>
                    <TableCell align="right">Min</TableCell>
                    <TableCell align="right">Max</TableCell>
                    <TableCell align="right">{`Price ${res.currency}/${res.priceBasis}`}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {res.rows.map((r, i) => (
                    <TableRow key={(r.code ?? "") + i} hover>
                      <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.74rem", color: "#15223a" }}>{r.code || "—"}</TableCell>
                      <TableCell sx={{ fontSize: "0.74rem", color: "#4a5a70", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.brand}</TableCell>
                      <TableCell><Chip label={r.material} size="small" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: "#eef2f8", color: "#4a5a70" }} /></TableCell>
                      <TableCell><Chip label={r.form} size="small" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, textTransform: "capitalize", bgcolor: FORM_COLOR[r.form] || FORM_COLOR.other, color: "#4a5a70" }} /></TableCell>
                      <TableCell sx={{ fontSize: "0.72rem", color: MUTED, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.dimText}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.72rem", fontFamily: "monospace", color: MUTED }}>{r.dimMin ?? "—"}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.72rem", fontFamily: "monospace", color: MUTED }}>{r.dimMax ?? "—"}</TableCell>
                      <TableCell align="right" sx={{ fontSize: "0.78rem", fontFamily: "monospace", fontWeight: 700, color: r.price != null ? "#15223a" : "#c4c9ce" }}>{r.price != null ? r.price.toFixed(2) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ px: 2, py: 1.2, borderTop: "1px solid #f0f1f3" }}>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>Verify against the PDF, then export — next step joins each line to its A+P article (Benchmarking Table) and derives GWStdP = price × net weight.</Typography>
            </Box>
          </Card>
        </>
      )}
    </Box>
  );
}
