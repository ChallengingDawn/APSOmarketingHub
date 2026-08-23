"use client";
import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/** Inline **bold** renderer — everything else stays literal. */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>
    )
  );
}

/**
 * Minimal, dependency-free markdown preview for generated blog/product
 * content: #/##/### headings, "-" bullets, tables, fenced code, paragraphs.
 */
export default function MarkdownPreview({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (line.trimStart().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <Box key={key++} component="pre" sx={{ bgcolor: "#16303f", color: "#d7e3ea", p: 1.5, borderRadius: 1.5, fontSize: 11.5, overflow: "auto", my: 1.5, fontFamily: "monospace" }}>
          {buf.join("\n")}
        </Box>
      );
      continue;
    }

    // table
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cells.every((c) => /^[-: ]+$/.test(c))) rows.push(cells);
        i++;
      }
      blocks.push(
        <Box key={key++} sx={{ overflowX: "auto", my: 1.5 }}>
          <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", "& td, & th": { border: "1px solid #e6e8ec", px: 1.25, py: 0.6, fontSize: 12.5, textAlign: "left" }, "& th": { bgcolor: "#f5f6f8", fontWeight: 700 } }}>
            <thead>
              <tr>{rows[0]?.map((c, j) => <th key={j}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, `t${ri}-${j}`)}</td>)}</tr>
              ))}
            </tbody>
          </Box>
        </Box>
      );
      continue;
    }

    // bullets
    if (/^\s*[-→]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-→]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-→]\s+/, ""));
        i++;
      }
      blocks.push(
        <Box key={key++} component="ul" sx={{ my: 1, pl: 3 }}>
          {items.map((it, j) => (
            <Typography key={j} component="li" sx={{ fontSize: 13.5, lineHeight: 1.7, color: "#1a1d21" }}>
              {inline(it, `li${j}`)}
            </Typography>
          ))}
        </Box>
      );
      continue;
    }

    // headings
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <Typography
          key={key++}
          sx={{
            fontFamily: "var(--font-outfit)",
            fontWeight: 700,
            color: "#1a1d21",
            letterSpacing: "-0.015em",
            fontSize: level === 1 ? 24 : level === 2 ? 18 : 15,
            mt: level === 1 ? 0.5 : 2.5,
            mb: 1,
          }}
        >
          {inline(h[2], `h${key}`)}
        </Typography>
      );
      i++;
      continue;
    }

    // blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // paragraph (merge consecutive non-empty, non-special lines)
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s|^\s*[-→]\s|^\s*\||^```/.test(lines[i].trimStart())) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push(
      <Typography key={key++} sx={{ fontSize: 13.5, lineHeight: 1.75, color: "#1a1d21", mb: 1.25, whiteSpace: "pre-wrap" }}>
        {inline(buf.join("\n"), `p${key}`)}
      </Typography>
    );
  }

  return <Box>{blocks}</Box>;
}
