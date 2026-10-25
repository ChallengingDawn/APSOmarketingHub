// MAP ASSIGNMENT - the rules as first seeded from the HubSpot workflows (read 19.10.2026). "Back to the start" on the
// page; the page can change EVERYTHING here (SAE table, source per country, zones, key accounts, defaults) - this file is
// only where it starts. Generated from the workflow dumps (scratchpad c555cd38 map/wf, map/data/gen_seed.mjs), then read.
//
// Where each part comes from:
//   sae        "SARCLA | COMPANY/CONTACT OWNER COPY FROM PERFORMIS" 3836456157: every SAE branch, the value exactly as the
//              branch filter has it -> the owner it writes (26 branches; anything else -> its default TSA Team). Owners
//              that have left since (Stahl, Nitschke, Bozek) are KEPT: the engine flags them and never writes them.
//              Not in the workflow, so not here: "Köremez James" (James Koeremez 38431796 - 230 companies fell to TSA on
//              19.10), "ESO CH GER" and the other ~25 unmapped values: they fall to the zones / default, flagged.
//              Its first branch "ANGST PFISTER" (company name contains "angst pfister" -> nothing) is not a rule here.
//   zones      "FEHDIA_Company_Owners_2510" 2937369826 (Diana): owner by country + postcode prefix for NL, AT, PL, IT, DE,
//              CH, FR; each country's DEFAULT branch -> TSA Team = defaultOwner. Contiguous runs of same-length prefixes
//              are written as ranges ("30-38"); Italy's exact Milano / Monza CAP lists as 5-digit ranges. The workflow
//              only acts when the company has NO SAE - the same as source "sae" here (SAE first, zones for the rest).
//              It also matches the zip / country of an associated contact; the hub reads the company's own.
//              The contact copy (2916185279) has the same tables; its CH branch's copy-paste bug (Jeremy also on French
//              département prefixes 01, 03, 07 ...) is NOT copied.
//   keys       ERP customer id lists: 2937369826 (IT Luca resellers, CH Claudio key customers, FR Jeremy) and
//              "FEHDIA_Company_Owners_Key_Customers_2510" 2947269830 (the same Luca + Jeremy lists, 55 Claudio ids of
//              which 26 are not on the CH list). 2947269830 has no country condition, so each id sits under the country
//              its company has in HubSpot (read 19.10: Claudio's are CH 262, LI 3, ES 3, PT 3); ids HubSpot does not
//              know stay in the workflow's country. The CH branch also takes segmentation "KEY CUSTOMER SARCLA": its 3
//              companies not on the lists are added as a snapshot. Italy's "contact industry = Reseller" criterion has
//              no rule form and is left out (85 reseller companies outside Luca's list, 10 of them without SAE).
//              NOTE: the engine puts key accounts BEFORE the SAE; the workflows only used them when the SAE was EMPTY.
//              All 274 companies on Claudio's lists have an SAE (19.10), so today they never act; seeded as they are,
//              they move 267 companies to Claudio (now Jan Kalt 238, Jeremy Borey 25, TSA 3, Denis 1). Luca's (130
//              companies) and Jeremy's (11) already have that owner: no change.
//   FR         SARCLA 19.10.2026: source "map"; Jeremy Borey = Auvergne-Rhône-Alpes + Bourgogne-Franche-Comté (20
//              département prefixes; the workflow had 19, without 90), the rest of France TSA Team.
//   CH         source "sae" (Performis first); zones as 2937369826: Jan Kalt / Jeremy Borey, the rest TSA Team. Ticino
//              65-69 is written as an explicit TSA zone (the workflow sends it to its default). The workflow's gaps are
//              kept as it has them: 50-59 (Aargau), 77, 84 (Winterthur) -> TSA default.
//   default    TSA Team.
//   people     SARCLA's KM workbook "Sales territory area by owner and country 2026-10-13.xlsx", sheet "Owner by country"
//              (116 rows, curated by hand: each person only in their home country, Jeremy Borey = FR + CH, Denis
//              Schawlochow = all his countries). SARCLA 19.10.2026: "countries have wrong ESO - should be fixed" - an SAE
//              that points to someone outside the country's people is not used there; the zone decides ("not-in-country").
//              Names -> owner ids from /crm/v3/owners (archived included: Nitschke, Stahl, Bozek stay where the sheet
//              has them - the engine never writes a deactivated owner). TSA Team is in every country's people (a team
//              like the others). The sheet's "(no owner)" rows are no one. A country not in the sheet has no list (anyone).
//              Countries the workflows had no rule for get a plain Performis rule (source "sae", no zones) carrying it.

import type { AssignRules, OwnerId } from "./rules";
import { SUCCESSORS_FROM_WORKFLOWS } from "./fixes";

const WORKFLOWS: AssignRules = {
  defaultOwner: "1202569408", // TSA Team
  // SARCLA 25.10.2026: who takes over from the people who have left - as the HubSpot redirection workflows move their
  // tickets and tasks (fixes.ts); the same is applied once to the saved rules
  successors: { ...SUCCESSORS_FROM_WORKFLOWS },
  sae: {
    "Borey Jeremy": "29117550", // Jeremy Borey - branch "JEREMY BOREY"
    "Schawlochow Denis": "1229999295", // Denis Schawlochow
    "TSA Team": "1202569408", // TSA Team
    // SARCLA 25.10.2026: Owner redirection's "owned by Sandra Kuridza -> James Koeremez" as the SAE table's own row
    // (that page is gone - fixes.ts "2026-10-25-redirections-on-the-map")
    "Kuridza Sandra": "38431796", // James Koeremez (was Sandra Kuridza 30052119)
    // SARCLA 19.10.2026: Sandra's customers go to James - Performis moved her list to "Köremez James" on 19.10 and the
    // workflow had no branch for it (230 companies to TSA Team)
    "Köremez James": "38431796", // James Koeremez
    // SARCLA 19.10.2026: "ESO CH GER is Jan Kalt" (182 companies, no branch in the workflow -> TSA Team)
    "ESO CH GER": "37053854", // Jan Kalt
    // SARCLA 20.10.2026: "WIESTE" is Stefan Wieneber (27 German companies, no branch in the workflow -> TSA Team)
    "WIESTE": "1229976035", // Stefan Wieneber
    "Bozek Paulina": "31218632", // Paulina Bozek (deactivated)
    "Lange Christoph": "1229998780", // Christoph Lange
    "Frech Marc": "817497321", // Marc Frech
    "Stahl Christopher": "32984810", // Christopher Stahl (deactivated) - branch "Stahl Christopher (TSA TEMP)"
    "Can Adem": "1229998585", // Adem Can
    "Höhn Hans-Peter": "1229976027", // Hans Peter Höhn
    "Nitschke Benjamin": "1229976034", // Benjamin Nitschke (deactivated) - branch "Nitschke Benjamin (TSA TEMP)"
    "Rausmann Bernd": "817647087", // Bernd Rausmann
    "Wieneber Stefan": "1229976035", // Stefan Wieneber
    "Storm Katja": "1229998779", // Katja Storm
    "Pielock Nancy": "1229976026", // Nancy Pielock
    "Mandl Tamara": "1229976036", // Tamara Mandl
    "Lonardi Raffaello": "33688321", // Raffaello Lonardi
    "Saraiva Claudio": "1229976033", // Claudio Saraiva
    "Van der Loo Nigel": "1230006208", // Nigel van der Loo
    "Vitale Simone": "1255191254", // Simone Vitale
    "Fantasia Luca Mirko": "1229999587", // Luca Fantasia
    "Kalt Jan": "37053854", // Jan Kalt
    "Gustak Marzena": "1229976029", // Maya Marzena Gustak
    "Falk Luna": "1229976031", // Luna Bianca Falk
    // SARCLA 24.10.2026: "Yani Alioua's companies should all go to Jeremy"
    "Alioua Yani": "29117550", // Jeremy Borey
    "Di Martino Vincenzo": "37659386", // Vincenzo Di Martino
    // SARCLA 24.10.2026: "Resident APZ goes to TSA"; the SAE values written as a person's name go to that person
    // ("these are mistakes and should be corrected") - the same corrections fixes.ts applies once to the saved rules
    "Resident APZ": "1202569408", // TSA Team
    "Sara Gashi": "30050251", // Sara Gashi
    "Leart Asllani": "37413486", // Leart Asllani
    "Claudio Gabinato": "1229976030", // Claudio Gabinato
    "Hans Peter Höhn": "1229976027", // Hans Peter Höhn
    "Luca Fantasia": "1229999587", // Luca Fantasia
  },
  countries: {
    CH: {
      country: "CH",
      source: "sae",
      // branch "Claudio Saraiva" also takes sarcla_segmentation_ch = KEY CUSTOMER SARCLA: no rule form - its companies not on the ERP list are a key-account snapshot below
      zones: [
        // workflow branch "Kalt Jan" -> Jan Kalt
        { id: "ch-jan-kalt", owner: "37053854", label: "Jan Kalt", prefixes: ["30-38", "40-49", "60-64", "70-76", "78-83", "85-99"] },
        // workflow branch "Jeremy Borey" -> Jeremy Borey
        { id: "ch-jeremy-borey", owner: "29117550", label: "Jeremy Borey", prefixes: ["10-29", "39"] },
        // the workflow's DEFAULT branch, Ticino written out -> TSA Team
        { id: "ch-ticino", owner: "1202569408", label: "TSA Team (Ticino)", prefixes: ["65-69"] },
      ],
      defaultOwner: "1202569408", // TSA Team
      keyAccounts: [
        { owner: "1229976033", label: "Claudio Saraiva - key customers", erpIds: [
          "700465", "700523", "700670", "700881", "701050", "701173", "701354", "701407", "701556", "701637", "701664", "701760",
          "701941", "701942", "702092", "702345", "702561", "702638", "702725", "702727", "702807", "702811", "702812", "702922",
          "703003", "703013", "703094", "703481", "703541", "703685", "703856", "703944", "704022", "704173", "704293", "704312",
          "704348", "704456", "704566", "704667", "704718", "704721", "704946", "705096", "705129", "705212", "705287", "705378",
          "705429", "705440", "705493", "705846", "705880", "705932", "705989", "706134", "706214", "706482", "706617", "706663",
          "706760", "706780", "706783", "706830", "706892", "707150", "707305", "707318", "707359", "707707", "707767", "707925",
          "708128", "708153", "708340", "708364", "708622", "708757", "709048", "709275", "709487", "709503", "709520", "709553",
          "709562", "709587", "709670", "709777", "709853", "710017", "710080", "710206", "710215", "710248", "710340", "710359",
          "710722", "710819", "710843", "710847", "710865", "711082", "711214", "711275", "711302", "711793", "712013", "712064",
          "712184", "712581", "712703", "712796", "713531", "713778", "714154", "714223", "714455", "714503", "714513", "714640",
          "715071", "715461", "715866", "715872", "716300", "716339", "716573", "717763", "718272", "718378", "718535", "718538",
          "719051", "719153", "719260", "719381", "719427", "719471", "720131", "720407", "720413", "720662", "720779", "720827",
          "720935", "721165", "721218", "721829", "722217", "722251", "722977", "723783", "724505", "724562", "725962", "726108",
          "726228", "726267", "727522", "727613", "727818", "728713", "729625", "731190", "731441", "731644", "731973", "732279",
          "732453", "732550", "732664", "733078", "733759", "735032", "735360", "735793", "735832", "738989", "739461", "739755",
          "740260", "741416", "742467", "743177", "743562", "744045", "744157", "744707", "784400", "784579", "785717", "786176",
          "786883", "787810", "788203", "788310", "788636", "791385", "792097", "793131", "799177", "800114", "800307", "801476",
          "801804", "804819", "806303", "806657", "810130", "810174", "811334", "813109", "813908", "815217", "815326", "818866",
          "819147", "819893", "820900", "820927", "820971", "822401", "822510", "823174", "831758", "837368", "837704", "838221",
          "839008", "839168", "839334", "839906", "840228", "841187", "841437", "841648", "842018", "842835", "844253", "844839",
          "844844", "844915", "845670", "846079", "846239", "846639", "846873", "848239", "849422", "850053", "850747", "855975",
          "857564", "858925", "859392", "859451", "860044", "862667", "864661", "864926", "865364", "865378",
        ] },
        { owner: "1229976033", label: "Claudio Saraiva - segmentation KEY CUSTOMER SARCLA (snapshot 19.10.2026)", erpIds: ["702988", "710513", "724620"] },
      ],
    },
    DE: {
      country: "DE",
      source: "sae",
      zones: [
        // workflow branch "Bernd Raussmann" -> Bernd Rausmann
        { id: "de-bernd-rausmann", owner: "817647087", label: "Bernd Rausmann", prefixes: ["44-49"] },
        // workflow branch "Hans-Peter Hoehn" -> Hans Peter Höhn
        { id: "de-hans-peter-hohn", owner: "1229976027", label: "Hans Peter Höhn", prefixes: ["54-56", "60-69", "76"] },
        // workflow branch "Adem Can" -> Adem Can
        { id: "de-adem-can", owner: "1229998585", label: "Adem Can", prefixes: ["36", "90-92", "95-98"] },
        // workflow branch "Christoph Lange" -> Christoph Lange
        { id: "de-christoph-lange", owner: "1229998780", label: "Christoph Lange", prefixes: ["77-79", "869", "87-88"] },
        // workflow branch "Benjamin Nitschke" -> Benjamin Nitschke (deactivated)
        { id: "de-benjamin-nitschke", owner: "1229976034", label: "Benjamin Nitschke", prefixes: ["01-09", "15", "99"] },
        // workflow branch "Placeholder for Tobias Witt - TSA now" -> TSA Team
        { id: "de-tsa-team-placeholder-for-tobias-witt", owner: "1202569408", label: "TSA Team", prefixes: ["20-22", "26-29"] },
        // workflow branch "Katja Storm" -> Katja Storm
        { id: "de-katja-storm", owner: "1229998779", label: "Katja Storm", prefixes: ["34-35", "40-42", "50-53", "57-59"] },
        // workflow branch "Stefan Wieneber" -> Stefan Wieneber
        { id: "de-stefan-wieneber", owner: "1229976035", label: "Stefan Wieneber", prefixes: ["10-14", "16", "30-33", "37-39"] },
        // workflow branch "Placeholder for Volkan/Vanessa" -> Christopher Stahl (deactivated)
        { id: "de-christopher-stahl-placeholder-for-volkan-vanessa", owner: "32984810", label: "Christopher Stahl", prefixes: ["70-75", "860-868", "89"] },
        // workflow branch "Marc Frech" -> Marc Frech
        { id: "de-marc-frech", owner: "817497321", label: "Marc Frech", prefixes: ["80-85", "93-94"] },
      ],
      defaultOwner: "1202569408", // TSA Team
    },
    FR: {
      country: "FR",
      // SARCLA 20.10.2026: "starting point is always rule 1" - France too: the SAE first, these zones only for a
      // company without one (was "map" since 19.10). And in France the SAE "TSA Team" (2,155 companies, all on Jeremy
      // through Owner redirection) is overruled to Jeremy Borey.
      source: "sae",
      saeOverride: { "TSA Team": "29117550" }, // Jeremy Borey
      zones: [
        // SARCLA 19.10.2026: Auvergne-Rhône-Alpes (01 03 07 15 26 38 42 43 63 69 73 74) + Bourgogne-Franche-Comté (21 25 39 58 70 71 89 90) -> Jeremy Borey
        { id: "fr-jeremy-borey", owner: "29117550", label: "Jeremy Borey", prefixes: [
          "01", "03", "07", "15", "21", "25", "26", "38", "39", "42",
          "43", "58", "63", "69", "70", "71", "73", "74", "89", "90",
        ] },
      ],
      defaultOwner: "1202569408", // TSA Team
      keyAccounts: [
        { owner: "29117550", label: "Jeremy Borey - key customers", erpIds: ["223728", "759771", "760068", "782980", "797740", "837478", "845383", "849070", "859580", "859927", "860988", "864028"] },
      ],
    },
    IT: {
      country: "IT",
      source: "sae",
      // branch "Luca Fantasia" also takes a contact with eyemagine_industry = 3.3 Rivenditori / Reseller: no rule form, left out (see the header)
      zones: [
        // workflow branch "Luca Fantasia" -> Luca Fantasia
        { id: "it-luca-fantasia", owner: "1229999587", label: "Luca Fantasia", prefixes: ["00-09", "64-67", "70-76", "80-98"] },
        // workflow branch "Simone Vitale" -> Simone Vitale
        { id: "it-simone-vitale", owner: "1255191254", label: "Simone Vitale", prefixes: ["10-19", "21", "26-29", "41-43", "50-59", "20001-20099", "20121-20162"] },
        // workflow branch "Raffaello Lonardi" -> Raffaello Lonardi
        { id: "it-raffaello-lonardi", owner: "33688321", label: "Raffaello Lonardi", prefixes: [
          "22-25", "30-40", "44-48", "60-63", "20811-20816", "20821-20826", "20831-20838", "20841-20847", "20851-20857", "20861-20867",
          "20871-20877", "20881-20886", "20900",
        ] },
      ],
      defaultOwner: "1202569408", // TSA Team
      keyAccounts: [
        { owner: "1229999587", label: "Luca Fantasia - resellers (key customer list)", erpIds: [
          "769891", "769972", "770028", "770158", "770194", "770354", "770405", "770900", "771175", "771511", "771561", "771636",
          "771827", "771855", "771947", "771951", "771990", "772079", "772101", "772350", "772386", "772504", "772637", "773000",
          "773474", "774062", "774167", "774200", "774434", "774505", "774533", "774542", "774791", "775096", "775187", "775302",
          "775305", "775321", "775539", "775715", "775787", "775805", "776213", "776334", "776651", "776652", "776738", "777591",
          "777826", "777982", "778055", "778066", "778162", "778366", "778534", "778578", "778593", "778727", "778774", "778932",
          "778980", "779159", "779173", "779237", "779294", "779361", "779735", "779974", "780016", "780023", "780130", "780236",
          "780349", "780426", "780434", "780477", "780507", "780559", "780650", "780739", "780761", "780765", "780784", "780868",
          "782191", "783191", "785256", "788306", "788577", "792697", "798246", "798261", "798264", "798282", "798699", "801985",
          "802429", "803702", "803703", "804046", "804784", "805478", "806010", "809234", "809335", "810371", "810559", "819234",
          "820891", "821070", "821132", "821874", "822286", "823277", "823813", "823868", "837789", "839034", "839041", "839204",
          "839720", "840473", "840898", "842410", "842987", "843962", "844754", "845017", "846478", "847230", "860202",
        ] },
      ],
    },
    AT: {
      country: "AT",
      source: "sae",
      zones: [
        // workflow branch "Tamara Mandl" -> Tamara Mandl
        { id: "at-tamara-mandl", owner: "1229976036", label: "Tamara Mandl", prefixes: ["10-49", "70-73"] },
      ],
      defaultOwner: "1202569408", // TSA Team
    },
    NL: {
      country: "NL",
      source: "sae",
      zones: [
        // workflow branch "Niger van der Loo" -> Nigel van der Loo
        { id: "nl-nigel-van-der-loo", owner: "1230006208", label: "Nigel van der Loo", prefixes: ["50-81", "93-95"] },
      ],
      defaultOwner: "1202569408", // TSA Team
    },
    PL: {
      country: "PL",
      source: "sae",
      zones: [
        // workflow branch "Paulina Kulczyk" -> Paulina Bozek (deactivated)
        { id: "pl-paulina-bozek", owner: "31218632", label: "Paulina Bozek", prefixes: ["00-05", "10-14", "19", "60-64", "75-77", "80-89"] },
      ],
      defaultOwner: "1202569408", // TSA Team
    },
    LI: {
      country: "LI",
      source: "sae",
      zones: [],
      keyAccounts: [
        { owner: "1229976033", label: "Claudio Saraiva - key customers", erpIds: ["701967", "732800", "789740"] },
      ],
    },
    ES: {
      country: "ES",
      source: "sae",
      zones: [],
      keyAccounts: [
        { owner: "1229976033", label: "Claudio Saraiva - key customers", erpIds: ["808926", "811009", "862707"] },
      ],
    },
    PT: {
      country: "PT",
      source: "sae",
      zones: [],
      keyAccounts: [
        { owner: "1229976033", label: "Claudio Saraiva - key customers", erpIds: ["757308", "852939", "855982"] },
      ],
    },
  },
};

/** The people who work each country - "Owner by country" (see the header), TSA Team first. */
export const SEED_PEOPLE: Record<string, OwnerId[]> = {
  CH: ["1202569408", "29117550", "37053854", "1229976029", "1229999295", "1229976031", "1229976026", "32968527", "38431796", "1229976033"], // TSA Team, Jeremy Borey, Jan Kalt, Maya Marzena Gustak, Denis Schawlochow, Luna Bianca Falk, Nancy Pielock, Yani Alioua, James Koeremez, Claudio Saraiva
  DE: ["1202569408", "1229976034", "1229976035", "1229998585", "1229976027", "1229998779", "817497321", "32984810", "1229998780", "817647087"], // TSA Team, Benjamin Nitschke (deactivated), Stefan Wieneber, Adem Can, Hans Peter Höhn, Katja Storm, Marc Frech, Christopher Stahl (deactivated), Christoph Lange, Bernd Rausmann
  IT: ["1202569408", "1229999587", "1255191254", "33688321", "37659386"], // TSA Team, Luca Fantasia, Simone Vitale, Raffaello Lonardi, Vincenzo Di Martino
  FR: ["1202569408", "29117550", "38431796"], // TSA Team, Jeremy Borey, James Koeremez (SARCLA 20.10.2026: his 178 French SAE companies go to him)
  NL: ["1202569408", "1230006208"], // TSA Team, Nigel van der Loo
  AT: ["1202569408", "1229976036"], // TSA Team, Tamara Mandl
  PL: ["1202569408", "31218632"], // TSA Team, Paulina Bozek (deactivated)
  BE: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  GB: ["1202569408"], // TSA Team
  CZ: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  ES: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  HU: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  RO: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  PT: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  TR: ["1202569408"], // TSA Team
  SK: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  SI: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  US: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  SE: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  DK: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  BG: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  LI: ["1202569408"], // TSA Team
  HR: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  CN: ["1202569408"], // TSA Team
  SG: ["1202569408"], // TSA Team
  IE: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  FI: ["1202569408"], // TSA Team
  MY: ["1202569408"], // TSA Team
  NO: ["1202569408"], // TSA Team
  LV: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  LT: ["1202569408"], // TSA Team
  LU: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  EE: ["1202569408"], // TSA Team
  TH: ["1202569408"], // TSA Team
  KR: ["1202569408"], // TSA Team
  ID: ["1202569408"], // TSA Team
  IN: ["1202569408"], // TSA Team
  RU: ["1202569408"], // TSA Team
  JP: ["1202569408"], // TSA Team
  MA: ["1202569408"], // TSA Team
  SM: ["1202569408"], // TSA Team
  AE: ["1202569408"], // TSA Team
  CY: ["1202569408"], // TSA Team
  CA: ["1202569408"], // TSA Team
  HK: ["1202569408"], // TSA Team
  PH: ["1202569408"], // TSA Team
  MT: ["1202569408", "1229999295"], // TSA Team, Denis Schawlochow
  IS: ["1202569408"], // TSA Team
  MC: ["1202569408"], // TSA Team
};

/** Every country's people on its rule; a country the workflows had no rule for gets a Performis rule with no zones. */
function withPeople(base: AssignRules, people: Record<string, OwnerId[]>): AssignRules {
  const countries = { ...base.countries };
  for (const [cc, list] of Object.entries(people)) countries[cc] = { ...(countries[cc] ?? { country: cc, source: "sae" as const, zones: [] }), people: [...list] };
  return { ...base, countries };
}

export const SEED: AssignRules = withPeople(WORKFLOWS, SEED_PEOPLE);
