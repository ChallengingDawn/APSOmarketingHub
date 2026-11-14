"use client";
import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PageHeader from "../../PageHeader";
import { RowDetail, DetailModeToggle } from "../../RowDetail";
import { useDetailMode } from "@/lib/pricing/prefs";

// the hub passes these calls to the PricingHub backend (src/app/api/pricing/api/[...path]/route.ts)
const API_URL = "/api/pricing";
const RED = "#c8463a", MUTED = "#5d6b85", NAVY = "#274e64";

type ListMeta = {
  id: number; supplier: string; customer_no: string | null; currency: string;
  price_basis: string; valid_from: string | null; filename: string | null;
  row_count: number; created_at: string;
};
type Row = { code: string | null; brand: string; material: string; form: string; dimText: string; dimMin: number | null; dimMax: number | null; price: number | null };

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

export default function LogsPage() {
  const [lists, setLists] = useState<ListMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [rows, setRows] = useState<Record<number, Row[]>>({});
  const [detailMode, setDetailMode] = useDetailMode();

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/purchasing/lists`).then(r => r.json())
      .then(j => setLists(j.lists || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const toggle = async (id: number) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!rows[id]) {
      const j = await fetch(`${API_URL}/api/purchasing/lists/${id}`).then(r => r.json()).catch(() => null);
      if (j?.rows) setRows(m => ({ ...m, [id]: j.rows }));
    }
  };

  const remove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this digested price list and its rows?")) return;
    await fetch(`${API_URL}/api/purchasing/lists/${id}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  return (
    <Box>
      <PageHeader icon="logs" eyebrow="Purchasing" title="Logs"
        subtitle="Every supplier price list digested via OCR & Mapping. The Benchmark shows the latest; here you can review or remove any version."
        rightSlot={<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><DetailModeToggle mode={detailMode} onChange={setDetailMode} /><Chip label={`${lists.length} file${lists.length === 1 ? "" : "s"}`} sx={{ fontWeight: 700, bgcolor: "#fdecee", color: RED }} /></Box>} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress sx={{ color: RED }} /></Box>
      ) : lists.length === 0 ? (
        <Card sx={{ border: "1px dashed #d8dce1", borderRadius: 3, p: 4, textAlign: "center", bgcolor: "#fafbfc" }}>
          <Typography sx={{ fontWeight: 700, color: "#15223a", mb: 0.5 }}>No files yet</Typography>
          <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>Digest a supplier price list in OCR &amp; Mapping and it will appear here.</Typography>
        </Card>
      ) : (
        <Card sx={{ border: "1px solid #e4e9f1", borderRadius: 2.5 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.68rem", color: MUTED, textTransform: "uppercase", letterSpacing: 0.3, bgcolor: "#f7f8fa", whiteSpace: "nowrap" } }}>
                  <TableCell width={40} />
                  <TableCell>Supplier</TableCell>
                  <TableCell>File</TableCell>
                  <TableCell>Valid from</TableCell>
                  <TableCell>Prices</TableCell>
                  <TableCell align="right">Rows</TableCell>
                  <TableCell>Uploaded</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {lists.map((l, li) => (
                  <React.Fragment key={l.id}>
                    <TableRow hover sx={{ cursor: "pointer" }} onClick={() => toggle(l.id)}>
                      <TableCell><KeyboardArrowRightIcon sx={{ fontSize: 20, color: MUTED, transform: openId === l.id ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} /></TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#15223a" }}>{l.supplier || "—"}{l.customer_no && <Typography component="span" sx={{ fontSize: "0.7rem", color: MUTED, ml: 0.75 }}>· {l.customer_no}</Typography>}</TableCell>
                      <TableCell sx={{ fontSize: "0.74rem", color: "#4a5a70", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.filename || "—"}</TableCell>
                      <TableCell sx={{ fontSize: "0.74rem", color: MUTED }}>{l.valid_from ? new Date(l.valid_from).toLocaleDateString() : "—"}</TableCell>
                      <TableCell><Chip size="small" label={`${l.currency}/${l.price_basis}`} sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: "#e8f5e9", color: "#2e7d32" }} /></TableCell>
                      <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.76rem", color: NAVY }}>{l.row_count}</TableCell>
                      <TableCell sx={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap" }}>{fmtDate(l.created_at)}</TableCell>
                      <TableCell align="right"><IconButton size="small" onClick={(e) => remove(l.id, e)}><DeleteOutlineIcon sx={{ fontSize: 18, color: "#b6bcc4", "&:hover": { color: RED } }} /></IconButton></TableCell>
                    </TableRow>
                    <RowDetail mode={detailMode} open={openId === l.id} onClose={() => setOpenId(null)} colSpan={8} maxWidth="lg"
                      title={`${l.supplier || "Supplier"} · ${l.filename || "price list"}`}
                      subtitle={`${l.row_count} rows · ${l.currency}/${l.price_basis}${l.valid_from ? ` · valid from ${new Date(l.valid_from).toLocaleDateString("de-CH")}` : ""}`}
                      onPrev={li > 0 ? () => toggle(lists[li - 1].id) : undefined}
                      onNext={li < lists.length - 1 ? () => toggle(lists[li + 1].id) : undefined}>
                          <Box sx={{ p: 1.5, bgcolor: "#fafbfc" }}>
                            {!rows[l.id] ? (
                              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={18} sx={{ color: RED }} /></Box>
                            ) : (
                              <TableContainer sx={{ maxHeight: detailMode === "popup" ? "70vh" : 380 }}>
                                <Table size="small" stickyHeader>
                                  <TableHead>
                                    <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.62rem", color: MUTED, textTransform: "uppercase", bgcolor: "#f1f3f5" } }}>
                                      <TableCell>Code</TableCell><TableCell>Brand</TableCell><TableCell>Material</TableCell><TableCell>Form</TableCell><TableCell>Dimension</TableCell><TableCell align="right">{`Price ${l.currency}/${l.price_basis}`}</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {rows[l.id].map((r, i) => (
                                      <TableRow key={(r.code ?? "") + i}>
                                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 700 }}>{r.code || "—"}</TableCell>
                                        <TableCell sx={{ fontSize: "0.7rem", color: "#4a5a70", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.brand}</TableCell>
                                        <TableCell sx={{ fontSize: "0.68rem", color: MUTED }}>{r.material}</TableCell>
                                        <TableCell sx={{ fontSize: "0.68rem", color: MUTED, textTransform: "capitalize" }}>{r.form}</TableCell>
                                        <TableCell sx={{ fontSize: "0.68rem", color: MUTED }}>{r.dimText}</TableCell>
                                        <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.72rem" }}>{r.price != null ? r.price.toFixed(2) : "—"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            )}
                          </Box>
                    </RowDetail>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
}
