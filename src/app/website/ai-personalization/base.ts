"use client";

// APSOconvert is ONE app with ONE menu (SARCLA 08.11.2026: "then it changes to other menu, it's really not correct" - a
// click on "Its visitors' flow" or "Test it on the shop" opened Visitor journeys' or A/B testing's menu). The page tests
// and a page's flow are therefore ALSO served inside the app (/website/ai-personalization/tests, /journeys - the same
// components); a component shared with those apps keeps its links inside whichever app it is shown in.

import { usePathname } from "next/navigation";

export const CONVERT = "/website/ai-personalization";

/** True when the page is shown inside APSOconvert (its own menu), false inside A/B testing or Visitor journeys. */
export function useInConvert(): boolean {
  return (usePathname() ?? "").startsWith(CONVERT);
}

/** Where the page tests live, in the app the person is in. */
export const testsBase = (inConvert: boolean) => (inConvert ? `${CONVERT}/tests` : "/website/ab-testing/pages");

/** One page's flow, in the app the person is in. */
export const flowHref = (inConvert: boolean, path: string) =>
  `${inConvert ? `${CONVERT}/journeys` : "/website/journeys/page"}?path=${encodeURIComponent(path)}`;
