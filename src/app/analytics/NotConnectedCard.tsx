"use client";

// The one honest empty state: which source is missing, the exact secret names to
// set, what the page will show once they are set, and the way to the control
// room. Never a blurred fake preview.

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

const NAVY = "#274e64";
const RED = "#ed1b2f";
const INK = "#1a1d21";
const MUTED = "#5b6470";
const HAIRLINE = "#e3e6ea";
const SURFACE = "#f5f6f8";

export const LABEL_SX = {
  fontSize: "11.5px",
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase" as const,
  color: MUTED,
};

function SecretName({ name }: { name: string }) {
  return (
    <Box
      component="code"
      sx={{
        display: "inline-block",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "0.78rem",
        fontWeight: 600,
        color: INK,
        bgcolor: SURFACE,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 1,
        px: 1,
        py: 0.4,
      }}
    >
      {name}
    </Box>
  );
}

export default function NotConnectedCard({
  source,
  missing,
  optional = [],
  unlocks,
  detail,
}: {
  /** e.g. "Google Analytics 4" */
  source: string;
  /** Exact env/secret names the API reported as missing. */
  missing: string[];
  /** Names that are not required but change what is read (e.g. GA4_PROPERTY_ID). */
  optional?: string[];
  /** One line: what this page shows once the source is connected. */
  unlocks: string;
  /** Diagnostic string the API returned, if any. */
  detail?: string | null;
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: { xs: 4, md: 8 } }}>
      <Box
        sx={{
          maxWidth: 560,
          width: "100%",
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 2,
          bgcolor: "#fff",
          p: { xs: 3, md: 4 },
          textAlign: "center",
        }}
      >
        <Typography sx={{ ...LABEL_SX, color: RED, mb: 1.5 }}>Not connected</Typography>

        <Typography
          sx={{
            fontFamily: "var(--font-outfit), 'Outfit', 'Inter', sans-serif",
            fontSize: "1.35rem",
            fontWeight: 500,
            color: INK,
            letterSpacing: "-0.02em",
            mb: 1,
          }}
        >
          {source} is not connected
        </Typography>

        <Typography sx={{ fontSize: "0.88rem", color: MUTED, mb: 3, lineHeight: 1.6 }}>
          {unlocks} Nothing is shown until the live source answers — this page never
          displays sample figures.
        </Typography>

        <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 2.5, mb: 3 }}>
          <Typography sx={{ ...LABEL_SX, mb: 1.5 }}>Required environment variables</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
            {missing.length > 0 ? (
              missing.map((name) => <SecretName key={name} name={name} />)
            ) : (
              <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
                The API did not name a missing variable.
              </Typography>
            )}
          </Box>

          {optional.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, mb: 1 }}>
                Optional — falls back to the built-in default when unset:
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
                {optional.map((name) => (
                  <SecretName key={name} name={name} />
                ))}
              </Box>
            </Box>
          )}

          {detail && (
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 2, fontStyle: "italic" }}>
              {detail}
            </Typography>
          )}
        </Box>

        <Button
          component={Link}
          href="/settings/integrations"
          variant="contained"
          disableElevation
          sx={{
            bgcolor: NAVY,
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.85rem",
            px: 2.5,
            "&:hover": { bgcolor: "#1d3d50" },
          }}
        >
          Open Integrations settings
        </Button>
      </Box>
    </Box>
  );
}

/** Connected, but the upstream call failed — report the provider's words verbatim. */
export function UpstreamErrorCard({
  source,
  error,
  status,
  onRetry,
}: {
  source: string;
  error: string;
  status: number | null;
  onRetry?: () => void;
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: { xs: 4, md: 8 } }}>
      <Box
        sx={{
          maxWidth: 620,
          width: "100%",
          border: `1px solid ${HAIRLINE}`,
          borderLeft: `3px solid ${RED}`,
          borderRadius: 2,
          bgcolor: "#fff",
          p: { xs: 3, md: 4 },
        }}
      >
        <Typography sx={{ ...LABEL_SX, color: RED, mb: 1.5 }}>
          {status === null ? "Upstream error" : `Upstream error · HTTP ${status}`}
        </Typography>
        <Typography
          sx={{
            fontFamily: "var(--font-outfit), 'Outfit', 'Inter', sans-serif",
            fontSize: "1.2rem",
            fontWeight: 500,
            color: INK,
            mb: 1.5,
          }}
        >
          {source} is configured but did not answer
        </Typography>
        <Box
          sx={{
            bgcolor: SURFACE,
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 1,
            p: 1.5,
            mb: 2.5,
          }}
        >
          <Typography
            sx={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.78rem",
              color: INK,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="contained"
              disableElevation
              sx={{
                bgcolor: NAVY,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.85rem",
                "&:hover": { bgcolor: "#1d3d50" },
              }}
            >
              Try again
            </Button>
          )}
          <Button
            component={Link}
            href="/settings/integrations"
            variant="outlined"
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.85rem",
              color: NAVY,
              borderColor: HAIRLINE,
              "&:hover": { borderColor: NAVY, bgcolor: SURFACE },
            }}
          >
            Check the connection
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
