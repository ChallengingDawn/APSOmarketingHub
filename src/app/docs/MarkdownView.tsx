"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface Props {
  content: string;
}

/**
 * Minimal GitHub-flavoured markdown renderer — no external dependency.
 * Supports: headings (h1-h4), paragraphs, bullet/numbered lists, bold, inline code,
 * fenced code blocks, tables, horizontal rules, links, and task lists.
 */

type Block =
  | { kind: "h1" | "h2" | "h3" | "h4"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; text: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "hr" }
  | { kind: "blank" };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      blocks.push({ kind: `h${level}` as Block["kind"], text: headingMatch[2].trim() } as Block);
      i++;
      continue;
    }

    // Table (GFM) — header row followed by separator row ( | --- | --- )
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[-:\s|]+\|?\s*$/.test(lines[i + 1])) {
      const header = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: "table", header, rows });
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      blocks.push({ kind: "blank" });
      i++;
      continue;
    }

    // Paragraph: accumulate consecutive non-empty lines
    const paraBuf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].startsWith("```") &&
      !/^---+$/.test(lines[i].trim()) &&
      !(lines[i].includes("|") && i + 1 < lines.length && /^\s*\|?[-:\s|]+\|?\s*$/.test(lines[i + 1]))
    ) {
      paraBuf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", text: paraBuf.join(" ") });
  }

  return blocks;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** Render inline markdown: **bold**, `code`, [links](url), ✅/❌/emojis as-is. */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} style={{ fontWeight: 700, color: "#1f1f1f" }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          style={{
            fontFamily: "'SF Mono', Menlo, monospace",
            fontSize: "0.82em",
            background: "#f1f3f4",
            padding: "1px 6px",
            borderRadius: 4,
            color: "#c7254e",
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        parts.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#1a73e8", textDecoration: "none" }}
          >
            {linkMatch[1]}
          </a>
        );
      }
    }
    lastIndex = m.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function MarkdownView({ content }: Props) {
  const blocks = parseBlocks(content);

  return (
    <Box sx={{ maxWidth: 960, "& > * + *": { mt: 1.5 } }}>
      {blocks.map((b, idx) => {
        if (b.kind === "blank") return null;

        if (b.kind === "hr")
          return (
            <Box
              key={idx}
              sx={{ height: 1, bgcolor: "#ececec", my: 3 }}
            />
          );

        if (b.kind === "h1")
          return (
            <Typography
              key={idx}
              sx={{
                fontFamily: "'Outfit', 'Inter', sans-serif",
                fontSize: "1.6rem",
                fontWeight: 700,
                color: "#1f1f1f",
                letterSpacing: "-0.02em",
                mt: idx === 0 ? 0 : 4,
                mb: 1.5,
                pb: 1,
                borderBottom: "1px solid #ececec",
              }}
            >
              {renderInline(b.text)}
            </Typography>
          );

        if (b.kind === "h2")
          return (
            <Typography
              key={idx}
              sx={{
                fontFamily: "'Outfit', 'Inter', sans-serif",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#1f1f1f",
                letterSpacing: "-0.015em",
                mt: 3.5,
                mb: 1,
              }}
            >
              {renderInline(b.text)}
            </Typography>
          );

        if (b.kind === "h3")
          return (
            <Typography
              key={idx}
              sx={{
                fontFamily: "'Outfit', 'Inter', sans-serif",
                fontSize: "1.05rem",
                fontWeight: 600,
                color: "#1f1f1f",
                letterSpacing: "-0.01em",
                mt: 2.5,
                mb: 0.75,
              }}
            >
              {renderInline(b.text)}
            </Typography>
          );

        if (b.kind === "h4")
          return (
            <Typography
              key={idx}
              sx={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#3c4043",
                mt: 2,
                mb: 0.5,
              }}
            >
              {renderInline(b.text)}
            </Typography>
          );

        if (b.kind === "p")
          return (
            <Typography
              key={idx}
              sx={{
                fontSize: "0.88rem",
                lineHeight: 1.65,
                color: "#3c4043",
              }}
            >
              {renderInline(b.text)}
            </Typography>
          );

        if (b.kind === "ul")
          return (
            <Box
              key={idx}
              component="ul"
              sx={{
                pl: 3,
                my: 1,
                "& li": {
                  fontSize: "0.88rem",
                  lineHeight: 1.65,
                  color: "#3c4043",
                  mb: 0.5,
                },
              }}
            >
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </Box>
          );

        if (b.kind === "ol")
          return (
            <Box
              key={idx}
              component="ol"
              sx={{
                pl: 3,
                my: 1,
                "& li": {
                  fontSize: "0.88rem",
                  lineHeight: 1.65,
                  color: "#3c4043",
                  mb: 0.5,
                },
              }}
            >
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </Box>
          );

        if (b.kind === "code")
          return (
            <Box
              key={idx}
              component="pre"
              sx={{
                bgcolor: "#fafbfc",
                border: "1px solid #ececec",
                borderRadius: 2,
                p: 2,
                fontFamily: "'SF Mono', Menlo, monospace",
                fontSize: "0.78rem",
                lineHeight: 1.55,
                color: "#3c4043",
                overflowX: "auto",
                my: 1.5,
              }}
            >
              {b.text}
            </Box>
          );

        if (b.kind === "table")
          return (
            <Box
              key={idx}
              sx={{
                my: 2,
                overflowX: "auto",
                border: "1px solid #ececec",
                borderRadius: 2,
              }}
            >
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.82rem",
                  "& th, & td": {
                    borderBottom: "1px solid #f1f3f4",
                    borderRight: "1px solid #f1f3f4",
                    textAlign: "left",
                    verticalAlign: "top",
                    px: 1.5,
                    py: 1,
                  },
                  "& th:last-child, & td:last-child": { borderRight: "none" },
                  "& tbody tr:last-child td": { borderBottom: "none" },
                  "& th": {
                    bgcolor: "#fafbfc",
                    fontWeight: 700,
                    color: "#1f1f1f",
                    fontSize: "0.78rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  },
                  "& td": {
                    color: "#3c4043",
                    lineHeight: 1.5,
                  },
                }}
              >
                <thead>
                  <tr>
                    {b.header.map((h, j) => (
                      <th key={j}>{renderInline(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((cell, k) => (
                        <td key={k}>{renderInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
          );

        return null;
      })}
    </Box>
  );
}
