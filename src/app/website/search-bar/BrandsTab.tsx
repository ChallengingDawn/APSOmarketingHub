"use client";

// Search bar > Brands: the brand names the bar recognises in a search, with the material and maker each stands
// for (the dashboard's "Brand names").

import { useState } from "react";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, MUTED, bodyCell, headCell } from "@/app/uc/report/ui";
import { usePaged } from "@/app/connectors/parts";
import type { Brand } from "@/lib/searchbar/gateway";
import { Empty, Loaded } from "./shared";

function Rows({ brands }: { brands: Brand[] }) {
  const [find, setFind] = useState("");
  const f = find.trim().toLowerCase();
  const rows = f ? brands.filter((b) => [b.brand, b.material, b.vendor, b.notes].join(" ").toLowerCase().includes(f)) : brands;
  const { slice, pager } = usePaged(rows, 20);
  return (
    <>
      <Box sx={{ px: { xs: 2, md: 2.75 }, mb: 1.5 }}>
        <TextField size="small" placeholder="Find a brand, material or maker…" value={find} onChange={(e) => setFind(e.target.value)} sx={{ width: 300 }} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 600 }}>
          <TableHead><TableRow>{["Brand", "Material", "Maker", "Note"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={4} sx={bodyCell}><Empty>No brand matches.</Empty></TableCell></TableRow>}
            {slice.map((b) => (
              <TableRow key={b.brand} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600 }}>{b.brand}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{b.material}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{b.vendor}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{b.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </>
  );
}

export default function BrandsTab() {
  return (
    <Loaded<{ total: number; brands: Brand[] }> url="/api/website/search-bar?part=brands" what="the brands">
      {(d) => (
        <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
          <Box sx={{ px: { xs: 2, md: 2.75 } }}>
            <CardTitle icon={<LocalOfferOutlinedIcon />} tint="amber" title="Brand names the bar recognises" note={`${full(d.total)} brands - a search for one shows that brand's products and material`} />
          </Box>
          <Rows brands={d.brands ?? []} />
        </GlassCard>
      )}
    </Loaded>
  );
}
