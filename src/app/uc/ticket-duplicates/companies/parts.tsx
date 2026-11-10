"use client";

// DUPLICATES & MERGES > Companies - what the page and its table share: a company's words (its customer number, never
// "ERP": SARCLA 10.11.2026 "take out all mention of ERP" - say customer number), links, the kinds of group.

import Box from "@mui/material/Box";
import { hsCompany } from "@/app/reporting/CompanyList";
import { INK, TINT } from "@/app/uc/report/ui";
import type { Company, Group } from "@/lib/companyDuplicates/rules";

export const dmy = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
export const cap = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

/** "NO ERP ID (LEAD)" and its kind, in the page's words */
export const placeholderLabel = (p: string | null) => (!p ? "no customer number" : /lead/i.test(p) ? "no customer number (lead)" : /eso/i.test(p) ? "no customer number (created by ESO)" : "no customer number");
/** the customer number and its Mandant, or why there is none */
export const numberText = (c: Company) => (c.erp ? `${c.erp}${c.mandant ? ` · ${c.mandant}` : ""}` : placeholderLabel(c.placeholder));
export const place = (c: Company) => [c.zip, c.city].filter(Boolean).join(" ") || cap(c.country);

export const link = (id: string, text: string) => (
  <Box component="a" href={hsCompany(id)} target="_blank" rel="noreferrer" title="Open in HubSpot" onClick={(e: React.MouseEvent) => e.stopPropagation()}
    sx={{ color: INK, textDecoration: "underline", textDecorationColor: "rgba(21,34,58,.35)", textUnderlineOffset: "3px", "&:hover": { color: TINT.blue.fg } }}>{text}</Box>
);

export type Kind = "both" | "place" | "website" | "other" | "number" | "family" | "sites" | "big";
export const kindOf = (g: Group): Kind => g.kind === "erp" ? "number" : g.kind !== "possible" ? g.kind
  : g.shared.length > 1 ? "both" : g.shared[0] === "place" ? "place" : g.otherNames ? "other" : "website";
export const KIND_LABEL: Record<Kind, string> = {
  both: "Name, postcode and website", place: "Name and postcode", website: "Website and name", other: "Website, another name",
  number: "Customer number", family: "A group's companies", sites: "Sites in two countries", big: "Too many to be one",
};
