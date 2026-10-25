import assert from "node:assert/strict";
import { test } from "node:test";
import { PERSONAS, countryCode, derivePersona, hasSignal, keyOfValue, type CompanyFacts, type ContactFacts } from "../src/lib/personas/rules";

const k = (c: ContactFacts, co: CompanyFacts | null = null) => derivePersona(c, co).key;
const OEM_DE = { apic_ap: "1.1 Machine Manufacturing (OEM)", country: "Germany", numberofemployees: "120" };

test("personas: HubSpot's values and the workflow's names", () => {
  assert.equal(PERSONAS.P1.value, "persona_2");
  assert.equal(PERSONAS.UN.value, "persona_10");
  assert.equal(keyOfValue("persona_9"), "P8");
  assert.equal(keyOfValue(null), null);
  assert.equal(countryCode("Österreich"), "AT");
  assert.equal(countryCode("ch"), "CH");
});

test("personas: the company rules the workflow never reached (it read no company)", () => {
  assert.equal(k({ jobtitle: "Einkauf" }, { apic_ap: "3.1 Distributor" }), "P8");
  assert.equal(k({}, { apic_ap: "4.1 Toll manufacturing" }), "P5");
  assert.equal(k({}, { apic_ap: "2.3 Chemical plant" }), "P6");
  assert.equal(k({ job_position: "Purchaser" }, OEM_DE), "P1");
  assert.equal(k({ job_position: "Owner" }, { country: "Switzerland", numberofemployees: "12" }), "P4");
  assert.equal(k({ jobtitle: "Buyer" }, { country: "France", apso_customer: "APSOgrowth" }), "P2");
  assert.equal(k({ jobtitle: "Responsabile acquisti" }, { country: "Italy" }), "P3");
});

test("personas: umlauts and accents match (the workflow's own words were garbled)", () => {
  assert.equal(k({ jobtitle: "Technischer Einkäufer" }, OEM_DE), "P1");
  assert.equal(k({ jobtitle: "Geschäftsführer" }, { country: "Österreich", numberofemployees: "20" }), "P4");
  assert.equal(k({ jobtitle: "Président" }, { country: "Suisse", numberofemployees: "8" }), "P4");
  assert.equal(k({ jobtitle: "Ingénieur méthodes" }), "P7");
});

test("personas: words the dropdown already knew, now also in the title", () => {
  assert.equal(k({ jobtitle: "Project Leader" }), "P7"); // job_position "Project Leader" was Engineer already
  assert.equal(k({ jobtitle: "Senior Project Manager" }), "P7");
  assert.equal(k({ jobtitle: "Service Technician" }), "P7");
  assert.equal(k({ jobtitle: "Mechanic" }), "P6");
  assert.equal(k({ jobtitle: "Purchase" }, OEM_DE), "P1");
  assert.equal(k({ jobtitle: "Chief Executive Officer" }, { country: "DE", numberofemployees: "40" }), "P4");
});

test("personas: the workflow's order - first match wins", () => {
  // maintenance beats engineer, engineer beats Italy
  assert.equal(k({ jobtitle: "Maintenance engineer" }), "P6");
  assert.equal(k({ jobtitle: "Ingegnere" }, { country: "Italy" }), "P7");
  // a reseller company beats any title
  assert.equal(k({ jobtitle: "Konstrukteur" }, { apic_ap: "3.2 Wholesale" }), "P8");
});

test("personas: a product owner is not the owner of the firm; the ERP country first", () => {
  const v = derivePersona({ jobtitle: "Product Owner" }, { country: "DE", numberofemployees: "10" });
  assert.equal(v.key, "UN");
  assert.equal(v.why, "job title matches no persona");
  assert.equal(k({ job_position: "Purchaser" }, { ...OEM_DE, country: "France", country_custom: "Switzerland" }), "P1");
});

test("personas: why a contact stays Unclassified", () => {
  assert.equal(derivePersona({}, null).why, "no job and no company");
  assert.equal(derivePersona({}, { apic_ap: "1.12 Robotics" }).why, "no job - company has an industry");
  assert.equal(derivePersona({ jobtitle: "Acheteur" }, { country: "France" }).why, "purchaser outside DACH and Italy");
  assert.equal(derivePersona({ jobtitle: "Einkauf" }, { country: "DE", numberofemployees: "20", apic_ap: "1.1" }).why, "purchaser in DACH - not a machine builder of 50+ or APSOgrowth");
  assert.equal(derivePersona({ job_position: "Owner" }, { country: "DE", numberofemployees: "300" }).why, "owner in DACH - company over 50 people or size unknown");
  // the workflow left a contact with no job and no company as it was - so does the hub
  assert.equal(hasSignal({}, null), false);
  assert.equal(hasSignal({ jobtitle: "x" }, null), true);
  assert.equal(hasSignal({}, { apic_ap: "1.1" }), true);
});
