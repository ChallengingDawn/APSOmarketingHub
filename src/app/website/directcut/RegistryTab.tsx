"use client";

// DirectCut: the cut-article numbers we minted, and the plate area a basket is sitting on.
//
// SARCLA, 17.10.2026: "we dont have anymore the article that are created and the holding of na article
// since basket." Both were on the Railway dashboard and neither had made it here. They answer two
// questions the board cannot:
//
//   THE REGISTRY  every cut-article number this ledger ever minted. It is what lets a number arriving on an
//                 order be recognised at all, and it is exactly what a card in "ordered by number only" is
//                 missing — that number was never minted here, so its basis and size are unknown.
//   THE HOLDS     the plate area a basket is sitting on right now, whose basket it is, and when it lapses.
//                 A hold is the reason a plate the shelf shows is not actually free.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import TagOutlinedIcon from "@mui/icons-material/TagOutlined";
import LockClockOutlinedIcon from "@mui/icons-material/LockClockOutlined";
import { Choice, usePaged } from "@/app/connectors/parts";
import { CardTitle, FAINT, GREEN, GlassCard, INK, MUTED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { full } from "@/app/charts/format";
import { Pill, when, type Holds, type Registry } from "./shared";

type View = "numbers" | "holds";

const m2 = (mm2: number) => (mm2 / 1e6).toFixed(2);

function Numbers({ reg, q, setQ }: { reg: Registry; q: string; setQ: (v: string) => void }) {
  const { slice, pager } = usePaged(reg.rows, 25);
  return (
    <>
      <Box sx={{ mb: 2 }}>
        <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 320 }}
          placeholder="article number, basis, 700x320"
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: FAINT }} /></InputAdornment> }} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headCell}>Cut article</TableCell>
              <TableCell sx={headCell}>Cut from</TableCell>
              <TableCell sx={headCell}>Size</TableCell>
              <TableCell sx={{ ...headCell, textAlign: "right" }}>Seen</TableCell>
              <TableCell sx={headCell}>First minted</TableCell>
              <TableCell sx={headCell}>Last seen</TableCell>
              <TableCell sx={headCell}>Last order</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {slice.map((r) => (
              <TableRow key={r.cutArticle} hover>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>{r.cutArticle}</Typography>
                </TableCell>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.84rem", color: INK }}>{r.basisArticle}</Typography>
                  {r.thickness ? <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.thickness} mm</Typography> : null}
                </TableCell>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.84rem", color: INK, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {r.l} × {r.w}<Box component="span" sx={{ color: FAINT, ml: 0.4, fontSize: "0.74rem" }}>mm</Box>
                  </Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(r.seenCount)}</TableCell>
                <TableCell sx={bodyCell}><Typography sx={{ fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.firstSeen)}</Typography></TableCell>
                <TableCell sx={bodyCell}><Typography sx={{ fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.lastSeen)}</Typography></TableCell>
                <TableCell sx={bodyCell}>
                  {/* the A-number where the ERP has reconciled it, the shop's own number until then */}
                  {r.lastOrderErpNo
                    ? <>
                        <Typography sx={{ fontSize: "0.8rem", color: INK, whiteSpace: "nowrap" }}>{r.lastOrderErpNo}</Typography>
                        <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>shop {r.lastOrderNo}</Typography>
                      </>
                    : <Typography sx={{ fontSize: "0.8rem", color: r.lastOrderNo ? MUTED : FAINT }}
                        title={r.lastOrderNo ? "the ERP has not reconciled this order yet, so there is no A-number" : undefined}>
                        {r.lastOrderNo || "never ordered"}
                      </Typography>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </>
  );
}

function HoldRows({ hold }: { hold: Holds }) {
  const rows = useMemo(() =>
    [...hold.orders].sort((a, b) => Number(a.expired) - Number(b.expired) || a.secondsLeft - b.secondsLeft), [hold.orders]);
  const { slice, pager } = usePaged(rows, 25);
  const area = hold.orders.reduce((s, o) => s + o.lines.reduce((t, l) => t + (l.areaMm2 || 0), 0), 0);

  return (
    <>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED, mb: 2 }}>
        {full(hold.orders.length)} hold(s) · {full(hold.orders.reduce((s, o) => s + o.totalParts, 0))} piece(s) ·{" "}
        {m2(area)} m² of plate not free
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headCell}>Basket</TableCell>
              <TableCell sx={headCell}>Whose</TableCell>
              <TableCell sx={headCell}>Article · plate</TableCell>
              <TableCell sx={{ ...headCell, textAlign: "right" }}>Pieces</TableCell>
              <TableCell sx={{ ...headCell, textAlign: "right" }}>Area</TableCell>
              <TableCell sx={headCell}>State</TableCell>
              <TableCell sx={headCell}>Lapses</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {slice.map((o) => (
              <TableRow key={o.orderId} hover>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.82rem", color: INK, ...clip(170) }} title={o.orderId}>{o.orderId}</Typography>
                  {o.source && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{o.source}</Typography>}
                </TableCell>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED, ...clip(190) }} title={o.customer ?? ""}>{o.customer || "—"}</Typography>
                </TableCell>
                <TableCell sx={bodyCell}>
                  {o.lines.map((l, i) => (
                    <Typography key={i} sx={{ fontSize: "0.8rem", color: INK, whiteSpace: "nowrap" }}>
                      {l.article} · {l.plate}
                    </Typography>
                  ))}
                </TableCell>
                <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(o.totalParts)}</TableCell>
                <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {m2(o.lines.reduce((s, l) => s + (l.areaMm2 || 0), 0))} m²
                </TableCell>
                <TableCell sx={bodyCell}>
                  {o.expired
                    ? <Pill text="lapsed" bg="#f2f2f4" fg="#5d6b85" />
                    : <Pill text={o.status} bg="#eef2fb" fg="#2459d1" />}
                </TableCell>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.8rem", color: o.expired ? FAINT : INK, whiteSpace: "nowrap" }}>
                    {o.expiresAt ? when(o.expiresAt) : "—"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </>
  );
}

export default function RegistryTab({ reg, hold, q, setQ }: { reg: Registry; hold: Holds; q: string; setQ: (v: string) => void }) {
  const [view, setView] = useState<View>("numbers");
  return (
    <GlassCard>
      <CardTitle
        icon={view === "numbers" ? <TagOutlinedIcon fontSize="small" /> : <LockClockOutlinedIcon fontSize="small" />}
        tint="purple"
        title={view === "numbers" ? "Cut articles we minted" : "Plate area a basket is holding"}
        note={view === "numbers"
          ? `${full(reg.total)} number(s) in the registry${q ? ` · ${full(reg.rows.length)} shown` : ""}`
          : "a hold is why a plate the shelf shows is not free"}
        right={
          <Choice<View>
            value={view} onChange={setView}
            options={[
              { key: "numbers", label: "Numbers", count: reg.total },
              { key: "holds", label: "Holds", count: hold.orders.length },
            ]}
          />
        }
      />
      {view === "numbers" ? <Numbers reg={reg} q={q} setQ={setQ} /> : <HoldRows hold={hold} />}
      {view === "numbers" && (
        <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 2 }}>
          A number that is <Box component="span" sx={{ color: GREEN }}>not</Box> in here cannot be recognised when it
          arrives on an order — that is what the Kanban&rsquo;s &ldquo;{"Not recorded"}&rdquo; column holds.
        </Typography>
      )}
    </GlassCard>
  );
}
