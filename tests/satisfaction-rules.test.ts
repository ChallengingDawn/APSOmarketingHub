import assert from "node:assert/strict";
import { test } from "node:test";
import { SHOP_CHAT_FORM, add, countryIso, csat, emptyTally, languageOf, localeOf, nps, readingOf, storeViewOf, touchpointOf } from "../src/lib/satisfaction/rules";

test("the touchpoint from the survey's name - TSA calls are one touchpoint, never per person", () => {
  assert.equal(touchpointOf("DE_CSAT_Order_Success_2403"), "order");
  assert.equal(touchpointOf("IT_CSAT_Live_Chat_2501"), "chat");
  assert.equal(touchpointOf("whatever", SHOP_CHAT_FORM), "shopchat");
  assert.equal(touchpointOf("EN_CSAT_BO_TICKET_2512"), "bo");
  assert.equal(touchpointOf("DE_CSAT_TSA_CALL_LUNA_2512"), "tsa");
  assert.equal(touchpointOf("DE_CSAT_TSA_CALL_NANCY_2512"), "tsa");
  assert.equal(touchpointOf("FR_GENERAL_NPS_2602"), "nps");
  assert.equal(touchpointOf("FR_Survey_Email_2503_Saraiva_followup"), "email");
  assert.equal(touchpointOf(null), "other");
});

test("language from the name's prefix, country to ISO, locale as the store views", () => {
  assert.equal(languageOf("DE_CSAT_Order_Success_2403"), "de");
  assert.equal(languageOf("PL_CSAT_BO_TICKET_2512"), "pl");
  assert.equal(languageOf("CSAT_without_prefix"), null);
  assert.equal(countryIso("Switzerland"), "CH");
  assert.equal(countryIso("Czech Republic"), "CZ");
  assert.equal(countryIso("ch"), "CH");
  assert.equal(countryIso(""), null);
  assert.equal(localeOf("de", "CH"), "de-CH");
  assert.equal(localeOf("fr", null), "fr-–");
  assert.equal(localeOf(null, null), null);
});

test("the store view from the address the survey was answered on", () => {
  assert.deepEqual(storeViewOf("https://www.apsoparts.com/de-DE/checkout/onepage/success/"), { language: "de", country: "DE" });
  assert.deepEqual(storeViewOf("https://www.apsoparts.com/en-CH/checkout/onepage/success/"), { language: "en", country: "CH" });
  assert.deepEqual(storeViewOf("https://www.apsoparts.com/fr-ch"), { language: "fr", country: "CH" });
  assert.equal(storeViewOf("https://www.apsoparts.com/checkout/onepage/success/"), null);
  assert.equal(storeViewOf("https://app-eu1.hubspot.com/feedback/26492587/satisfaction/9"), null);
  assert.equal(storeViewOf(null), null);
});

test("CSAT answers read as happy / neutral / unhappy; NPS kept apart", () => {
  assert.deepEqual(readingOf({ surveyName: "DE_CSAT_Order_Success_2403", sentiment: "Happy", value: "2", group: "PROMOTER" }), { sentiment: "happy", nps: null });
  assert.deepEqual(readingOf({ surveyName: "X", sentiment: null, value: 0 }), { sentiment: "unhappy", nps: null });
  assert.deepEqual(readingOf({ surveyName: "DE_GENERAL_NPS_2602", sentiment: "Promoter", value: "10", group: "PROMOTER" }), { sentiment: null, nps: "promoter" });
  assert.deepEqual(readingOf({ surveyName: "FR_GENERAL_NPS_2602", sentiment: "Detractor", value: "4", group: "DETRACTOR" }), { sentiment: null, nps: "detractor" });
  assert.deepEqual(readingOf({ surveyName: "X", value: "8" }), { sentiment: null, nps: "passive" });
});

test("CSAT = happy share of the CSAT answers; NPS = promoters - detractors", () => {
  const t = emptyTally();
  for (const s of ["happy", "happy", "happy", "neutral", "unhappy"] as const) add(t, { sentiment: s, nps: null });
  for (const g of ["promoter", "promoter", "passive", "detractor"] as const) add(t, { sentiment: null, nps: g });
  assert.equal(t.answers, 9);
  assert.equal(csat(t), 0.6);
  assert.equal(nps(t), 25);
  assert.equal(csat(emptyTally()), null);
  assert.equal(nps(emptyTally()), null);
});
