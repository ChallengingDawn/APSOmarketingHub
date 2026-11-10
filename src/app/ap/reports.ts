// The Angst+Pfister hub's reports - one list, so the front page and each report's own page agree (SARCLA 10.11.2026).
import type { IconKey } from "@/app/hubApps";

export type ApReport = {
  name: string;
  href: string;
  /** One line under the name, as Advanced reporting's tiles have. */
  line: string;
  /** What the figures cover. */
  scope: string;
  icon: IconKey;
  tint: string;
  fg: string;
};

export const AP_REPORTS: ApReport[] = [
  {
    name: "Sealing Business Review",
    href: "/ap/reporting/sealing",
    line: "Who buys, what sells, which materials and compounds lead - and where to focus next.",
    scope: "Every business unit · revenue and margin",
    icon: "bar",
    tint: "#e4f4ee",
    fg: "#0f6b4a",
  },
];
