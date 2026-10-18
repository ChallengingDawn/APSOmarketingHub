// BACK OFFICE ROUTING - THE TICKET CLASSIFIER, the pure part. A faithful port of "SARCLA MULTILINGUAL TICKET
// CLASSIFIER", the Python custom-code step #22 of HubSpot flow 3678508243 "SARCLA | BACK OFFICE MAIN ROUTING"
// (workflow snapshot 18.10.2026, code/3678508243-2.py). From a ticket's subject and content it decides what that
// step writes: enquiry_category, the category's own sub-category property, order_number.
// It is to be run in SHADOW MODE against the live step before anything is improved, so nothing is fixed here,
// even where the Python looks wrong. Kept as the Python has them: every keyword list (a keyword listed n times
// counts n times), the subject x10, the signature stripping, the first category / sub-category in list order
// winning a tie, and Python's string semantics - its whitespace for strip() and \s, its Unicode \w \b \d, len()
// by code point. No accent or umlaut folding: the Python only lower()s. No I/O; tests/bo-classifier.test.ts holds
// it to the Python's own output.

/* ── HubSpot property mapping ──────────────────────────────────────────── */
export const PROPERTY_MAPPING: { main_category: string; sub_categories: Record<string, string>; order_number: string } = {
  // Main category dropdown
  "main_category": "enquiry_category",

  // Sub-category dropdown properties (exact internal names from HubSpot)
  "sub_categories": {
    "Product Price": "enquiry_sub_category___price_1",
    "Product Information": "enquiry_sub_category___product_information___1",
    "Delivery": "enquiry_sub_category___delivery___1",
    "Website Issue": "enquiry_sub_category___website_issue___1",
    "Invoicing & Accounting": "enquiry_sub_category___invoicing___accounting___1",
    "Order Cancellation": "enquiry_sub_category___order_cancellation___1",
  },

  // Order number property
  "order_number": "order_number",
};

/* ── dropdown values: the exact options written into HubSpot ───────────── */
export const DROPDOWN_VALUES: Record<string, Record<string, string>> = {
  "Product Price": {
    "Price is not visible": "Price is not visible",
    "Request for quotation": "Request for quotation",
    "Wrong price on my order": "Wrong price on my order",
  },
  "Product Information": {
    "Technical question on a product": "Technical question on a product",
    "I need an alternative on a product": "I need an alternative on a existing product",
    "Product cannot be found in the system": "Product cannot be found in the shop/Alternative products",
    "Technical Data Sheet request": "Technical Data Sheet request",
    "3D Model request": "3D Model request",
    "Minimum order quantity for a product": "Minimum order quantity for a product",
    "Conformities / Certificates": "Conformities / Certificates",
  },
  "Delivery": {
    "I have not yet placed an order": "Pre Order",
    "Delivery is late": "Existing Order",
    "I require faster lead time": "Existing Order",
    "Issue with existing delivery": "Existing Order",
    "Previous order question": "Previous Order",
  },
  "Website Issue": {
    "Login Issue": "Login Issue",
    "Other Issue": "Other Issue",
  },
  "Invoicing & Accounting": {
    "Invoice not received": "Invoice not received",
    "Other invoicing issue": "Other invoicing issue",
  },
  "Order Cancellation": {
    "Cancel existing order": "Cancel existing order",
  },
};

/* ── comprehensive multilingual keywords ───────────────────────────────── */
export const KEYWORDS: Record<string, { main: string[]; sub: Record<string, string[]> }> = {
  "Product Price": {
    "main": [
      // English
      "price", "pricing", "cost", "costs", "quote", "quotation", "how much",
      "expensive", "cheap", "cheaper", "price list", "price inquiry", "budget",
      "discount", "discounts",

      // Order/quotation requests (moved from sub to main!)
      "rfq", "request quotation", "order request", "new order", "want to order",
      "place an order", "need a quote",

      // Purchase Order keywords - BOOSTED!
      "purchase order", "purchase order", "purchase order",  // 3x weight!
      "po number", "po number",
      "vendor", "vendor",

      // German
      "preis", "preise", "kosten", "kostenvoranschlag", "angebot", "offerte",
      "offerte erstellen", "offerte erstellen",
      "wie viel", "wieviel", "teuer", "günstig", "billiger", "billig",
      "tarif", "gebühr", "gebühren", "preisanfrage", "preisliste", "budget", "rabatt",

      // German order keywords - BOOSTED!
      "bestellen", "bestellen",  // 2x weight!
      "möchte bestellen", "bestellung aufgeben", "neue bestellung",

      // ATTACHMENT + ORDER CONTEXT - HEAVILY BOOSTED
      "in der anlage finden", "in der anlage finden", "in der anlage finden", "in der anlage finden",  // 4x weight!
      "im anhang", "im anhang", "im anhang", "im anhang", "im anhang",  // 5x weight
      "anbei", "anbei", "anbei", "anbei", "anbei", "anbei",  // 6x weight
      "in der anlage", "in der anlage", "in der anlage", "in der anlage",  // 4x weight
      "finden sie unsere", "finden sie unsere", "finden sie unsere", "finden sie unsere",  // 4x weight
      "erhalten sie bestellung", "erhalten sie bestellung", "erhalten sie bestellung",  // 3x
      "senden wir ihnen", "senden wir ihnen", "senden wir ihnen",  // 3x
      "sende ich ihnen", "sende ich ihnen",  // 2x

      // RESTORE "Bestellung" with CONTEXT
      "unsere bestellung", "unsere bestellung", "unsere bestellung", "unsere bestellung",  // 4x weight
      "die bestellung", "meine bestellung", "senden bestellung", "erhalten bestellung",

      // German RFQ submission phrases - BOOSTED
      "bitte um angebotsabgabe", "bitte um angebotsabgabe", "bitte um angebotsabgabe",  // 3x
      "bitte um angebot", "bitte um angebot", "bitte um angebot",  // 3x
      "ich bitte um", "ich bitte um",  // 2x
      "hier mal eine anfrage", "hier mal eine anfrage",  // 2x

      // French - RFQ "demande d'offre" variants - HEAVILY BOOSTED!
      "demande offre", "demande offre", "demande offre", "demande offre",  // 4x weight!
      "demandes offres", "demandes offres", "demandes offres",  // 3x weight!
      "demande d'offre", "demande d'offre", "demande d'offre", "demande d'offre",  // 4x weight!
      "demandes d'offres", "demandes d'offres", "demandes d'offres",  // 3x weight!
      "demande de prix", "demande de prix", "demande de prix", "demande de prix",  // 4x weight!
      "demandes de prix", "demandes de prix", "demandes de prix",  // 3x weight!
      "appel d'offre", "appel d'offre", "appel d'offre",  // 3x weight!
      "appel d'offres", "appel d'offres", "appel d'offres",  // 3x weight!
      "sollicitation de prix", "sollicitation prix",

      // French
      "prix", "coût", "coûts", "devis", "tarif", "combien", "cher", "pas cher",
      "économique", "budget", "offre de prix", "montant", "frais", "remise", "réduction",

      // French order keywords - BOOSTED!
      "commander", "nouvelle commande", "passer commande",
      "devis", "devis", "devis",  // 3x weight!
      "prix pour devis", "chiffrer", "chiffrer",  // 2x weight!
      "pouvez-vous chiffrer", "nous chiffrer",

      // French attachment + RFQ - HEAVILY BOOSTED
      "offre de prix selon", "offre de prix selon", "offre de prix selon", "offre de prix selon",  // 4x
      "selon annexe", "selon annexe", "selon annexe", "selon annexe",  // 4x
      "offre de prix", "offre de prix", "offre de prix",  // 3x boost more
      "faire une offre", "faire une offre", "faire une offre",  // 3x
      "merci de me faire", "merci de me faire", "merci de me faire",  // 3x
      "merci de me faire une offre", "merci de me faire une offre", "merci de me faire une offre",  // 3x
      "ci-joint", "ci-jointe", "ci joint", "ci jointe",  // French "attached"

      // Italian
      "prezzo", "prezzi", "costo", "costi", "preventivo", "quotazione", "quanto costa",
      "caro", "economico", "tariffa", "budget", "sconto",

      // Italian order keywords - BOOSTED!
      "ordinare", "ordinare",  // 2x weight!
      "nuovo ordine",

      // Italian quotation requests - HEAVILY BOOSTED!
      "quotazione", "quotazione", "quotazione", "quotazione", "quotazione",  // 5x weight!
      "richiedere offerta", "richiedere offerta", "richiedere offerta",  // 3x
      "migliore quotazione", "migliore quotazione", "migliore quotazione",  // 3x
      "vs migliore", "vostra migliore",
      "richiedere", "richiedere",  // 2x
      "allegato", "allegata", "allegati",  // Italian "attached"

      // Polish
      "cena", "ceny", "koszt", "koszty", "oferta", "wycena", "ile kosztuje",
      "drogi", "tani", "budżet", "rabat", "zniżka",

      // Polish order keywords - BOOSTED!
      "zamówić", "zamówić",  // 2x weight!
      "nowe zamówienie",
      "załącznik", "w załączniku",  // Polish "attached"

      // Dutch
      "prijs", "prijzen", "kosten", "offerte", "prijsopgave", "hoeveel",
      "duur", "goedkoop", "budget", "korting",

      // Dutch order keywords - BOOSTED!
      "bestellen", "bestellen",  // 2x weight!
      "nieuwe bestelling",
      "bijgevoegd", "bijlage",  // Dutch "attached"
    ],

    "sub": {
      "Price is not visible": [
        "can't see price", "cannot see price", "price not visible", "no price shown",
        "price hidden", "don't see price",
        "preis nicht sichtbar", "kann preis nicht sehen",
        "prix pas visible", "ne vois pas le prix",
        "prezzo non visibile", "non vedo il prezzo",
        "cena nie widoczna", "nie widzę ceny",
        "prijs niet zichtbaar", "zie geen prijs",
      ],

      "Request for quotation": [
        // English
        "need a quote", "request quotation", "quote request", "quotation please",
        "send quote", "get a quote", "rfq", "want to order", "would like to order",
        "place an order", "order request", "new order", "please find attached",
        "find attached", "purchase order", "po number",
        "vendor",

        // French - demande d'offre variants - SUPER BOOSTED!
        "demande offre", "demande offre", "demande offre", "demande offre", "demande offre",  // 5x
        "demande d'offre", "demande d'offre", "demande d'offre", "demande d'offre", "demande d'offre",  // 5x
        "demandes d'offres", "demandes d'offres", "demandes d'offres", "demandes d'offres",  // 4x
        "demande de prix", "demande de prix", "demande de prix", "demande de prix",  // 4x
        "demandes de prix", "demandes de prix", "demandes de prix",  // 3x
        "appel d'offre", "appel d'offre", "appel d'offre",  // 3x
        "appel d'offres", "appel d'offres", "appel d'offres",  // 3x

        // German - ATTACHMENT + ORDER SUBMISSION - SUPER BOOSTED
        "in der anlage finden", "in der anlage finden", "in der anlage finden", "in der anlage finden", "in der anlage finden",  // 5x
        "im anhang", "im anhang", "im anhang", "im anhang", "im anhang", "im anhang",  // 6x
        "anbei", "anbei", "anbei", "anbei", "anbei", "anbei", "anbei",  // 7x
        "in der anlage", "in der anlage", "in der anlage", "in der anlage", "in der anlage",  // 5x
        "finden sie unsere bestellung", "finden sie unsere bestellung", "finden sie unsere bestellung",  // 3x
        "erhalten sie bestellung", "erhalten sie bestellung", "erhalten sie bestellung",  // 3x
        "senden wir ihnen unsere", "senden wir ihnen unsere",  // 2x
        "unsere bestellung", "unsere bestellung", "unsere bestellung", "unsere bestellung", "unsere bestellung",  // 5x
        "hier mal eine anfrage", "hier mal eine anfrage", "hier mal eine anfrage",  // 3x
        "bitte um angebotsabgabe", "bitte um angebotsabgabe", "bitte um angebotsabgabe",  // 3x

        // ONLY keep "auftragsbestätigung" here in SUB with NEW ORDER context
        "neue auftragsbestätigung", "neue auftragsbestätigung",
        "auftragsbestätigung für neue bestellung",

        "angebot anfordern", "bitte um angebot", "bitte um ein angebot",
        "brauche angebot", "schnelles angebot",
        "anfrage", "anfrage", "anfrage",  // 3x weight
        "beigefügt", "beigefügt",  // 2x weight
        "möchte bestellen", "bestellung aufgeben", "neue bestellung", "bestellen",
        "bitte finden",

        // French - SUPER BOOSTED
        "offre de prix selon annexe", "offre de prix selon annexe", "offre de prix selon annexe",  // 3x
        "selon annexe", "selon annexe", "selon annexe", "selon annexe", "selon annexe",  // 5x
        "faire une offre de prix", "faire une offre de prix",  // 2x
        "merci de me faire une offre", "merci de me faire une offre", "merci de me faire une offre", "merci de me faire une offre",  // 4x
        "merci de me faire", "merci de me faire", "merci de me faire",  // 3x
        "ci-joint", "ci-jointe", "ci joint", "ci jointe",
        "demande de devis", "besoin d'un devis", "commander", "nouvelle commande",
        "passer commande", "faire parvenir", "arc", "accusé de réception",
        "commande ci-jointe",
        "devis", "devis", "devis",
        "prix pour devis",
        "chiffrer", "chiffrer", "chiffrer",
        "pouvez-vous chiffrer", "nous chiffrer",

        // Italian - SUPER BOOSTED
        "quotazione", "quotazione", "quotazione", "quotazione", "quotazione", "quotazione",  // 6x!
        "migliore quotazione", "migliore quotazione", "migliore quotazione", "migliore quotazione",  // 4x
        "richiedere offerta", "richiedere offerta", "richiedere offerta",  // 3x
        "vs migliore quotazione", "vs migliore quotazione",  // 2x
        "allegato", "allegata",
        "richiesta preventivo", "ho bisogno di un preventivo", "voglio ordinare", "nuovo ordine",

        // Polish
        "prośba o wycenę", "potrzebuję wyceny", "chcę zamówić", "nowe zamówienie",

        // Dutch
        "offerte aanvraag", "vraag om offerte", "wil bestellen", "nieuwe bestelling",
      ],

      "Wrong price on my order": [
        "wrong price", "incorrect price", "price error", "different price",
        "overcharged", "charged wrong",
        "falscher preis", "preis falsch", "preis stimmt nicht",
        "mauvais prix", "prix incorrect", "erreur de prix",
        "prezzo sbagliato", "prezzo errato",
        "zła cena", "błędna cena",
        "verkeerde prijs", "onjuiste prijs",
      ],
    }
  },

  "Product Information": {
    "main": [
      // English
      "product", "technical", "specification", "specs", "datasheet", "compatibility",
      "compatible", "dimensions", "technical question", "product details", "features",
      "instructions", "manual", "alternative", "replacement", "3d model", "cad",
      "certificate", "minimum order", "moq",

      // Regulatory compliance (HEAVILY BOOSTED!)
      "rohs", "rohs", "rohs", "rohs", "rohs", "rohs",  // 6x weight!
      "reach", "reach", "reach", "reach", "reach", "reach",  // 6x weight!
      "svhc", "svhc", "svhc", "svhc", "svhc",  // 5x weight!
      "fda", "fda", "fda", "fda", "fda", "fda", "fda", "fda",  // 8x weight!
      "tse", "tse", "tse", "tse", "tse", "tse",  // 6x weight!
      "bse", "bse", "bse", "bse", "bse", "bse",  // 6x weight!
      "atex", "atex", "atex", "atex", "atex", "atex", "atex",  // 7x weight!
      "compliance", "compliance", "compliance", "compliance",  // 4x weight
      "regulation", "directive", "directive",
      "substance", "hazardous substance", "declaration", "material declaration",
      "proposition 65", "prop 65", "pfas",

      // Document delivery phrases (German)
      "dokumente liefern", "dokumente liefern", "dokumente liefern",  // 3x weight
      "dokumente mitliefern", "dokumente mitliefern", "dokumente mitliefern",  // 3x weight
      "dokumente dazu", "dokumente zu",
      "können sie uns diese dokumente", "können sie uns diese dokumente",
      "bestätigt haben ob", "bestätigt haben",

      // German
      "produkt", "technisch", "spezifikation", "datenblatt", "kompatibel",
      "abmessungen", "technische frage", "anleitung", "alternative", "ersatz",
      "3d modell", "zertifikat", "mindestbestellmenge",

      // French
      "produit", "technique", "spécifications", "fiche technique", "compatible",
      "dimensions", "question technique", "instructions", "manuel", "alternative",
      "modèle 3d", "certificat", "quantité minimum",

      // Italian
      "prodotto", "tecnico", "specifiche", "scheda tecnica", "compatibile",
      "dimensioni", "domanda tecnica", "istruzioni", "alternativa", "modello 3d",
      "certificato", "quantità minima",

      // Polish
      "produkt", "techniczne", "specyfikacje", "karta katalogowa", "kompatybilny",
      "wymiary", "pytanie techniczne", "alternatywa", "zamiennik", "model 3d",
      "certyfikat", "minimalna ilość",

      // Dutch
      "product", "technisch", "specificaties", "datasheet", "compatibel",
      "afmetingen", "technische vraag", "alternatief", "3d model", "certificaat",
      "minimum bestelhoeveelheid",
    ],

    "sub": {
      "Technical question on a product": [
        "technical question", "how does it work", "technical data", "specification",
        "compatible with", "will it fit",
        "technische frage", "wie funktioniert", "kompatibel mit",
        "question technique", "comment ça marche",
        "domanda tecnica", "come funziona",
        "pytanie techniczne", "jak to działa",
        "technische vraag", "hoe werkt het",
      ],

      "I need an alternative on a product": [
        "alternative", "replacement", "substitute", "instead of", "similar product",
        "equivalent", "other option",
        "ersatz", "austausch", "ähnliches produkt",
        "remplacement", "substitut", "produit similaire",
        "alternativa", "sostituto", "prodotto simile",
        "alternatywa", "zamiennik", "podobny produkt",
        "alternatief", "vervanging", "vergelijkbaar product",
      ],

      "Product cannot be found in the system": [
        "cannot find", "can't find", "not found", "doesn't exist", "not in system",
        "not available", "where is product",
        "kann nicht finden", "nicht gefunden", "nicht im system",
        "ne trouve pas", "pas trouvé", "pas dans système",
        "non trovo", "non trovato", "non nel sistema",
        "nie mogę znaleźć", "nie znaleziono",
        "kan niet vinden", "niet gevonden",
      ],

      "Technical Data Sheet request": [
        "datasheet", "data sheet", "technical sheet", "product sheet", "specification sheet",
        "datenblatt", "technisches blatt",
        "fiche technique",
        "scheda tecnica",
        "karta techniczna",
        "technisch blad",
      ],

      "3D Model request": [
        "3d model", "3d file", "cad file", "step file", "drawing", "3d drawing",
        "3d modell", "cad datei",
        "modèle 3d", "fichier 3d",
        "modello 3d", "file 3d",
        "model 3d", "plik 3d",
      ],

      "Minimum order quantity for a product": [
        "minimum order", "moq", "minimum quantity", "minimum order quantity", "smallest order",
        "mindestbestellmenge", "mindestmenge",
        "quantité minimum", "commande minimum",
        "quantità minima", "ordine minimo",
        "minimalna ilość", "minimalne zamówienie",
        "minimum bestelhoeveelheid",
      ],

      "Conformities / Certificates": [
        // HEAVILY BOOSTED: Regulatory compliance keywords
        "rohs", "rohs", "rohs", "rohs", "rohs", "rohs", "rohs", "rohs",  // 8x weight!
        "reach", "reach", "reach", "reach", "reach", "reach", "reach", "reach",  // 8x weight!
        "svhc", "svhc", "svhc", "svhc", "svhc", "svhc", "svhc",  // 7x weight!
        "proposition 65", "prop 65", "prop 65", "prop 65", "prop 65",  // 5x weight!
        "pfas", "pfas", "pfas", "pfas", "pfas",  // 5x weight!

        // FDA, TSE/BSE, ATEX - SUPER BOOSTED!
        "fda", "fda", "fda", "fda", "fda", "fda", "fda", "fda", "fda", "fda",  // 10x weight!
        "tse", "tse", "tse", "tse", "tse", "tse", "tse", "tse",  // 8x weight!
        "bse", "bse", "bse", "bse", "bse", "bse", "bse", "bse",  // 8x weight!
        "atex", "atex", "atex", "atex", "atex", "atex", "atex", "atex", "atex",  // 9x weight!

        // German document request phrases - HEAVILY BOOSTED!
        "dokumente liefern", "dokumente liefern", "dokumente liefern", "dokumente liefern",  // 4x
        "dokumente mitliefern", "dokumente mitliefern", "dokumente mitliefern", "dokumente mitliefern",  // 4x
        "können sie uns diese dokumente", "können sie uns diese dokumente", "können sie uns diese dokumente",  // 3x
        "dokumente dazu", "dokumente dazu", "dokumente zu",
        "mitliefern können", "liefern können",
        "bestätigt haben ob", "bestätigt haben ob", "bestätigt haben",
        "zu einer bestellung kommt", "falls es zu einer bestellung",
        "erstellung dieser dokumente", "kosten für die erstellung",

        // Compliance declarations - BOOSTED!
        "compliance declaration", "compliance declaration", "compliance declaration", "compliance declaration",  // 4x
        "regulatory compliance", "regulatory compliance", "regulatory compliance", "regulatory compliance",  // 4x
        "substance declaration", "substance declaration", "substance declaration",  // 3x
        "environmental compliance", "environmental compliance", "environmental compliance",  // 3x
        "hazardous substances", "hazardous substances",

        // Standard keywords
        "certificate", "certification", "conformity", "ce mark", "compliance", "certified",
        "certification document", "regulation", "directive", "legislation",
        "substance list", "declarable substance", "restricted substance",
        "material declaration", "fmd", "full material declaration",

        // Multi-language
        "zertifikat", "zertifizierung", "konformität",
        "certificat", "certification", "conformité",
        "certificato", "certificazione", "conformità",
        "certyfikat", "certyfikacja", "zgodność",
        "certificaat", "certificering", "conformiteit",
      ],
    }
  },

  "Delivery": {
    "main": [
      // English
      "delivery", "shipping", "shipment", "sent", "send", "late", "delayed", "delay",
      "when", "arrival", "arrive", "tracking", "track", "receive", "received",
      "lead time", "not arrived", "urgent", "express", "fast delivery",
      "complaint", "non-conformity", "non-conformance", "NCM", "NCR", "defect",
      "defective", "quality issue", "quality complaint", "8D report", "root cause",
      "corrective action", "supplier complaint", "order portfolio", "open orders",
      "overdue orders", "overdue", "delivery note", "dispatch note", "shipped",

      // German
      "lieferung", "versand", "gesendet", "verspätet", "verzögert", "wann", "ankunft",
      "tracking", "dringend", "express", "schnelle lieferung",
      "vorziehen", "termin vorziehen", "liefertermin vorziehen",

      // Order modifications/cancellations
      "stornieren", "bestellung stornieren", "ändern", "änderung",

      // EXISTING ORDER DELIVERY REQUESTS - HEAVILY BOOSTED
      "bestellung vom", "bestellung vom", "bestellung vom", "bestellung vom",  // 4x
      "auftrag vom", "auftrag vom", "auftrag vom",  // 3x
      "liefern sie", "liefern sie", "liefern sie",  // 3x
      "bitte liefern", "bitte liefern", "bitte liefern",  // 3x

      // ORDER CORRECTIONS - SUPER BOOSTED!
      "angepasste auftragsbestätigung", "angepasste auftragsbestätigung", "angepasste auftragsbestätigung", "angepasste auftragsbestätigung", "angepasste auftragsbestätigung",  // 5x!
      "gutschrift für die preisänderungen", "gutschrift für die preisänderungen", "gutschrift für die preisänderungen", "gutschrift für die preisänderungen",  // 4x!
      "auftragsbestätigung mit preisänderungen", "auftragsbestätigung mit preisänderungen", "auftragsbestätigung mit preisänderungen",  // 3x!
      "preise so anzupassen", "preise so anzupassen", "preise so anzupassen",  // 3x
      "bitte senden sie uns eine angepasste", "bitte senden sie uns eine angepasste",  // 2x

      // Document requests for existing orders
      "zusenden", "nachsenden", "dokument zusenden",
      "zu diesem auftrag", "für diesen auftrag", "zu meinem auftrag",

      "beanstandung", "lieferantenbeanstandung", "reklamation", "fehler", "defekt",
      "mangel", "fehlerhaft", "qualitätsproblem", "lunker", "risse", "abweichung",
      "8d report", "ursachenanalyse", "korrekturmaßnahmen", "massnahmen",
      "auftragsportfolio", "offene aufträge",

      // French
      "livraison", "expédition", "envoyé", "retard", "retardé", "quand", "arrivée",
      "suivi", "reçu", "urgent", "express",

      // Order modifications/confirmations - HEAVILY BOOSTED!
      "veuillez nous livrer", "veuillez nous livrer", "veuillez nous livrer",  // 3x weight!
      "veuillez livrer", "veuillez livrer",  // 2x weight
      "mise à jour", "mise à jour", "mise à jour", "mise à jour", "mise à jour",  // 5x weight!
      "confirmation de commande mise à jour", "confirmation de commande mise à jour",
      "confirmation mise à jour",
      "nous renvoyer", "nous renvoyer", "nous renvoyer",  // 3x weight
      "renvoyer confirmation", "renvoyer confirmation",
      "confirmation de commande", "confirmation de commande",
      "confirmation provisoire", "confirmation provisoire",
      "longueurs suivantes", "longueurs",
      "quantités suivantes", "les quantités",

      // Document requests for existing orders
      "pour cette commande", "document pour commande", "envoyer document",
      "faire parvenir", "me faire parvenir", "faire parvenir copie",
      "attestation", "attestation de conformité", "copie attestation",

      "réclamation", "plainte", "non-conformité", "défaut", "défectueux",
      "problème qualité", "rapport 8d", "portefeuille commandes", "commandes ouvertes",
      "bon de livraison",

      // Italian
      "consegna", "spedizione", "inviato", "ritardo", "ritardato", "quando", "arrivo",
      "tracciamento", "ricevuto", "urgente", "espresso", "urgenti",
      "reclamo", "non conformità", "difetto", "difettoso", "problema qualità",

      // Order modifications/confirmations
      "si prega di consegnare", "per favore consegnare",
      "conferma d'ordine aggiornata", "conferma aggiornata",

      // Italian delivery-specific phrases
      "portafoglio ordini", "ordini aperti", "ordini scaduti", "giorni di ritardo",
      "materiale già spedito", "materiale spedito", "ddt", "inviare ddt",
      "allineamento ordini", "in rosso", "scaduti", "pertanto urgenti",

      // Polish
      "dostawa", "wysyłka", "wysłano", "opóźnienie", "kiedy", "śledzenie",
      "otrzymano", "pilne", "ekspres", "reklamacja", "niezgodność", "wada",
      "defekt", "problem jakości", "portfel zamówień", "otwarte zamówienie",

      // Dutch
      "levering", "verzending", "verzonden", "vertraging", "wanneer", "tracking",
      "ontvangen", "dringend", "spoed", "klacht", "non-conformiteit", "defect",
      "kwaliteitsprobleem", "orderportefeuille", "openstaande orders",
    ],

    "sub": {
      "I have not yet placed an order": [
        "haven't ordered yet", "not ordered yet", "before ordering", "planning to order",
        "will order", "going to order",
        "habe noch nicht bestellt", "bevor ich bestelle",
        "pas encore commandé", "avant de commander",
        "non ho ancora ordinato", "prima di ordinare",
        "jeszcze nie zamówiłem", "przed zamówieniem",
        "nog niet besteld", "voordat ik bestel",
      ],

      "Delivery is late": [
        "late", "delayed", "delay", "overdue", "should have arrived", "hasn't arrived",
        "not arrived yet", "still waiting", "taking too long",
        "verspätet", "verzögert", "noch nicht angekommen",
        "en retard", "retardé", "pas encore arrivé",
        "in ritardo", "ritardato", "non ancora arrivato",
        "spóźnione", "opóźnione", "jeszcze nie dotarło",
        "te laat", "vertraagd", "nog niet aangekomen",
      ],

      "I require faster lead time": [
        "faster", "quicker", "urgent", "rush", "expedite", "need sooner", "asap",
        "as soon as possible", "express delivery", "priority", "urgent delivery",
        "schneller", "dringend", "eilig", "express", "vorziehen", "termin vorziehen",
        "liefertermin vorziehen",
        "plus rapide", "urgent", "express", "prioritaire",
        "più veloce", "urgente", "espresso",
        "szybciej", "pilne", "ekspresowa",
        "sneller", "urgent", "spoed",
      ],

      "Issue with existing delivery": [
        "damaged", "broken", "wrong item", "missing", "incomplete", "defective",
        "incorrect delivery", "delivery problem",

        // Cancellation/modification of existing orders
        "cancel order", "cancel my order", "stornieren", "annuler", "modification", "change order", "ändern",

        // German - DELIVERY REQUESTS FOR EXISTING ORDERS - SUPER BOOSTED
        "bestellung vom", "bestellung vom", "bestellung vom", "bestellung vom", "bestellung vom",  // 5x
        "auftrag vom", "auftrag vom", "auftrag vom", "auftrag vom",  // 4x
        "bitte liefern sie mir", "bitte liefern sie mir", "bitte liefern sie mir",  // 3x
        "bitte liefern sie", "bitte liefern sie", "bitte liefern sie",  // 3x
        "bitte liefern", "bitte liefern",  // 2x
        "liefern sie mir", "liefern sie mir", "liefern sie mir",  // 3x
        "liefern sie", "liefern sie",  // 2x

        // French order modifications/confirmations - HEAVILY BOOSTED!
        "veuillez nous livrer", "veuillez nous livrer", "veuillez nous livrer",  // 3x weight!
        "veuillez livrer", "veuillez livrer",  // 2x weight
        "mise à jour", "mise à jour", "mise à jour", "mise à jour",  // 4x weight!
        "confirmation de commande mise à jour", "confirmation de commande mise à jour",
        "confirmation mise à jour",
        "nous renvoyer", "nous renvoyer", "nous renvoyer",  // 3x weight
        "renvoyer confirmation", "renvoyer confirmation",
        "confirmation de commande", "confirmation de commande",

        // French stock/availability issues
        "quantités suivantes", "quantités suivantes", "quantités suivantes",  // 3x weight!
        "ne disposons plus", "ne disposons plus", "ne disposons plus",  // 3x weight
        "plus que des quantités", "stock limité", "rupture de stock", "stock insuffisant",
        "comment procéder", "nous devons procéder", "comment devons-nous",
        "pourriez-vous nous indiquer", "pourriez-vous indiquer",
        "malheureusement", "malheureusement", "malheureusement",  // 3x weight
        "disponible", "disponibilité", "indisponible",
        "ne pouvons livrer", "impossible de livrer",
        "que des quantités", "seulement des quantités",

        // Italian order modifications/confirmations
        "si prega di consegnare", "si prega di consegnare",
        "per favore consegnare",
        "conferma d'ordine aggiornata", "conferma d'ordine aggiornata",
        "conferma aggiornata",

        // Multi-language damage/issue keywords
        "beschädigt", "kaputt", "falscher artikel", "fehlt",
        "endommagé", "cassé", "mauvais article", "manquant",
        "danneggiato", "rotto", "articolo sbagliato",
        "uszkodzone", "zepsute", "zły artykuł",
        "beschadigd", "kapot", "verkeerd artikel",
      ],

      "Previous order question": [
        "previous order", "past order", "old order", "last order", "earlier order",

        // Document requests for existing orders
        "for this order", "for this order", "for this order",  // 3x weight!
        "for my order", "for my order",
        "send for order", "send document for order",
        "certificate for this order", "conformity for this order",
        "document for order", "certificate for order", "conformity for order",
        "invoice for order", "delivery note for order",

        // Quality complaint keywords
        "complaint", "non-conformity", "non-conformance", "NCM", "NCR", "defect",
        "defective", "faulty", "quality issue", "8D report", "8d report",
        "root cause", "corrective action", "supplier complaint", "quality complaint",

        "vorherige bestellung", "alte bestellung",

        // German document requests for existing orders
        "zu diesem auftrag", "zu diesem auftrag", "zu diesem auftrag",  // 3x weight!
        "für diesen auftrag", "für diesen auftrag",
        "zu meinem auftrag", "für meinen auftrag",
        "zusenden zu auftrag", "nachsenden", "zusenden",
        "dokument für auftrag", "dokument zu auftrag",
        "zertifikat für auftrag", "konformität für auftrag",
        "konformitätserklärung für auftrag", "konformitätserklärung zusenden",
        "declaration of conformity für auftrag", "declaration für auftrag",

        // ORDER CORRECTION PHRASES - SUPER BOOSTED!
        "gutschrift für die preisänderungen", "gutschrift für die preisänderungen", "gutschrift für die preisänderungen", "gutschrift für die preisänderungen", "gutschrift für die preisänderungen",  // 5x!
        "gutschrift für", "gutschrift für", "gutschrift für", "gutschrift für", "gutschrift für", "gutschrift für",  // 6x
        "angepasste auftragsbestätigung", "angepasste auftragsbestätigung", "angepasste auftragsbestätigung", "angepasste auftragsbestätigung", "angepasste auftragsbestätigung", "angepasste auftragsbestätigung",  // 6x!
        "auftragsbestätigung mit preisänderungen", "auftragsbestätigung mit preisänderungen", "auftragsbestätigung mit preisänderungen", "auftragsbestätigung mit preisänderungen", "auftragsbestätigung mit preisänderungen",  // 5x!
        "korrigierte auftragsbestätigung", "korrigierte auftragsbestätigung", "korrigierte auftragsbestätigung",  // 3x
        "preisänderungen", "preisänderungen", "preisänderungen", "preisänderungen",  // 4x
        "preise so anzupassen", "preise so anzupassen", "preise so anzupassen", "preise so anzupassen",  // 4x
        "preise anzupassen", "preise anzupassen", "preise anzupassen",  // 3x
        "wie es bei uns hinterlegt", "wie es bei uns hinterlegt",
        "rot notierte preise", "rot notierte preise",
        "bitte senden sie uns eine angepasste", "bitte senden sie uns eine angepasste", "bitte senden sie uns eine angepasste",  // 3x
        "ihre bestellung", "ihre bestellung", "ihre bestellung", "ihre bestellung", "ihre bestellung",  // 5x

        "beanstandung", "lieferantenbeanstandung", "reklamation", "fehler", "defekt",
        "mangel", "fehlerhaft", "qualitätsproblem", "qualitätsmangel",
        "lunker", "risse", "abweichung", "8d report",
        "ursachenanalyse", "korrekturmaßnahmen", "massnahmen", "wurzelursache",

        "commande précédente", "ancienne commande",

        // French document requests for existing orders
        "pour cette commande", "pour cette commande", "pour cette commande",  // 3x weight
        "pour ma commande", "pour ma commande",
        "attestation de conformité pour", "attestation pour commande",
        "copie de l'attestation", "copie attestation",
        "faire parvenir attestation", "faire parvenir copie",
        "me faire parvenir", "me faire parvenir",
        "document pour commande", "certificat pour commande", "conformité pour commande",
        "envoyer pour commande",

        "réclamation", "plainte", "non-conformité", "défaut", "défectueux",
        "problème qualité", "rapport 8d", "action corrective",

        "ordine precedente", "vecchio ordine",

        // Italian document requests for existing orders
        "per questo ordine", "per questo ordine",
        "per il mio ordine", "documento per ordine", "certificato per ordine",
        "conformità per ordine", "inviare documento", "inviare per ordine",

        "reclamo", "non conformità", "difetto", "difettoso", "problema qualità",
        "rapporto 8d",

        "poprzednie zamówienie", "stare zamówienie",
        "reklamacja", "niezgodność", "wada", "defekt", "problem jakości", "raport 8d",

        "vorige bestelling", "oude bestelling",
        "klacht", "non-conformiteit", "defect", "kwaliteitsprobleem", "8d rapport",
      ],
    }
  },

  "Website Issue": {
    "main": [
      // English
      "website not working", "website issue", "website problem", "web issue",
      "web problem", "online issue", "login", "password", "can't login",
      "cannot login", "my account", "user account", "account login",
      "can't access", "cannot access", "page error", "page not loading",
      "broken page", "browser", "cart", "checkout",

      // German
      "webseite problem", "login problem", "passwort", "zugriff problem",
      "mein konto", "benutzerkonto", "funktioniert nicht", "seite problem",

      // French
      "site web problème", "problème connexion", "mot de passe", "accès problème",
      "mon compte", "compte utilisateur", "page erreur", "ne fonctionne pas",

      // Italian
      "sito web problema", "login problema", "password problema", "accesso problema",
      "mio account", "account utente", "pagina errore", "non funziona",

      // Polish
      "strona problem", "logowanie problem", "hasło problem", "dostęp problem",
      "moje konto", "konto użytkownika",

      // Dutch
      "website probleem", "inloggen probleem", "wachtwoord probleem", "toegang probleem",
      "mijn account", "gebruikersaccount",
    ],

    "sub": {
      "Login Issue": [
        "can't login", "cannot login", "login failed", "can't sign in", "password doesn't work",
        "kann mich nicht anmelden", "login geht nicht",
        "ne peux pas me connecter", "connexion échouée",
        "non riesco ad accedere", "accesso fallito",
        "nie mogę się zalogować", "logowanie nie działa",
        "kan niet inloggen", "inloggen mislukt",
      ],

      "Other Issue": [
        "other problem", "different issue", "something else", "not listed", "other error", "another problem",
        "anderes problem", "sonstiges",
        "autre problème", "différent",
        "altro problema", "diverso",
        "inny problem", "coś innego",
        "ander probleem", "iets anders",
      ],
    }
  },

  "Invoicing & Accounting": {
    "main": [
      // English
      "invoice", "invoices", "bill", "billing", "payment", "paid", "unpaid", "receipt",
      "credit note", "credit memo", "accounting", "vat", "tax", "invoice number",
      "refund", "overdue", "outstanding", "accountant", "debit note", "debit memo",
      "credit", "debtor", "creditor",

      // German - GUTSCHRIFT HEAVILY BOOSTED
      "gutschrift", "gutschrift", "gutschrift", "gutschrift", "gutschrift", "gutschrift", "gutschrift",  // 7x weight!
      "rechnung", "rechnungen", "zahlung", "bezahlt", "quittung",
      "buchhaltung", "buchhalter", "mwst", "mehrwertsteuer", "steuer",
      "rechnungsnummer", "rückerstattung", "überfällig", "storniert", "stornierung",
      "storno", "kreditor", "debitor", "gutschein",

      // French
      "facture", "factures", "paiement", "payé", "reçu", "avoir",
      "note de crédit", "note de credit", "comptabilité", "tva", "comptable",
      "numéro de facture", "remboursement", "annulé", "annulation",
      "créancier", "débiteur",

      // Italian
      "fattura", "fatture", "pagamento", "pagato", "ricevuta", "nota di credito",
      "nota di accredito", "contabilità", "iva", "numero fattura", "rimborso",
      "contabile", "stornato", "annullato",

      // Polish
      "faktura", "faktury", "płatność", "zapłacone", "paragon", "nota kredytowa",
      "księgowość", "księgowy", "vat", "numer faktury", "zwrot", "anulowane",
      "korekta faktury",

      // Dutch
      "factuur", "facturen", "betaling", "betaald", "bon", "creditnota", "credit nota",
      "boekhouding", "btw", "factuurnummer", "terugbetaling", "boekhouder",
      "geannuleerd", "gecrediteerd",
    ],

    "sub": {
      "Invoice not received": [
        "didn't receive invoice", "haven't received invoice", "no invoice",
        "invoice not sent", "missing invoice",
        "rechnung nicht erhalten", "keine rechnung",
        "pas reçu facture", "facture non reçue",
        "non ricevuto fattura", "fattura non ricevuta",
        "nie otrzymałem faktury", "brak faktury",
        "factuur niet ontvangen", "geen factuur",
      ],

      "Other invoicing issue": [
        "invoice problem", "billing issue", "payment issue", "invoice question",
        "accounting question", "credit note", "credit memo", "storniert", "stornierung",
        "gutschrift", "note de crédit", "nota di credito", "nota kredytowa",
        "creditnota", "cancelled invoice", "invoice correction",
        "rechnungsproblem", "zahlungsproblem",
        "problème facture", "problème paiement",
        "problema fattura", "problema pagamento",
        "problem z fakturą", "problem płatności",
        "factuurprobleem", "betalingsprobleem",
      ],
    }
  },

  "Order Cancellation": {
    "main": [
      // English
      "cancel", "cancellation", "cancel order", "stop order", "don't want",
      "changed my mind", "mistake", "wrong order", "refund", "return",

      // German - HEAVILY BOOSTED!
      "stornieren", "stornieren", "stornieren", "stornieren", "stornieren",  // 5x weight!
      "stornierung", "stornierung", "stornierung", "stornierung",  // 4x weight!
      "bestellung stornieren", "bestellung stornieren", "bestellung stornieren",  // 3x weight!
      "möchte stornieren", "möchte stornieren", "möchte stornieren",  // 3x weight!
      "abbrechen", "will nicht", "fehler", "falsche bestellung", "rückerstattung",

      // French - BOOSTED FOR CANCELLATION DETECTION!
      "annuler", "annulation", "annuler commande",
      "annulation de commande", "annulation de commande", "annulation de commande",  // 3x weight!
      "annulation commande", "annulation commande",  // 2x weight!
      "ci-joint notre annulation", "ci-jointe notre annulation",
      "veuillez trouver ci-joint notre annulation",
      "annuler la commande", "annulation de la commande",
      "souhaite annuler", "souhaite annuler",  // 2x weight
      "voudrais annuler", "veux annuler",
      "ne veux pas", "erreur", "mauvaise commande", "remboursement",

      // Italian
      "cancellare", "cancellazione", "annullare ordine", "non voglio", "errore",
      "ordine sbagliato", "rimborso",

      // Polish
      "anulować", "anulowanie", "anulować zamówienie", "nie chcę", "pomyłka",
      "złe zamówienie", "zwrot pieniędzy",

      // Dutch
      "annuleren", "annulering", "bestelling annuleren", "wil niet", "fout",
      "verkeerde bestelling", "terugbetaling",
    ],

    "sub": {
      "Cancel existing order": [
        "cancel my order", "cancel order", "stop my order", "want to cancel",
        "need to cancel", "please cancel",

        // German - BOOSTED
        "meine bestellung stornieren",
        "bestellung stornieren", "bestellung stornieren",
        "möchte stornieren", "möchte stornieren",
        "möchte gerne stornieren", "möchte die bestellung stornieren",
        "bitte stornieren", "bitte um bestätigung",

        "annuler ma commande", "annuler commande",
        "cancellare mio ordine", "cancellare ordine",
        "anulować moje zamówienie", "anulować zamówienie",
        "mijn bestelling annuleren", "bestelling annuleren",
      ],
    }
  },
};

export const CATEGORIES = Object.keys(KEYWORDS); // KEYWORDS order: the first of two equal scores wins

/* ── Python string semantics ───────────────────────────────────────────── */

// str.isspace() and re's \s: Python counts \x1c-\x1f and \x85, JavaScript's trim() counts ﻿ instead
const PY_WS = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const S = `[${PY_WS}]`;
const IS_S = new RegExp(`^${S}$`, "u");
// Python's \w (str patterns): letters, numbers, underscore - not combining marks; JavaScript's \b is ASCII only
const W = "[\\p{L}\\p{N}_]";
const IS_W = new RegExp(`^${W}$`, "u");
const B0 = `(?<!${W})`, B1 = `(?!${W})`;

/** str.strip() */
function pyStrip(s: string): string {
  let a = 0, b = s.length;
  while (a < b && IS_S.test(s[a])) a++;
  while (b > a && IS_S.test(s[b - 1])) b--;
  return s.slice(a, b);
}

/** len(s): code points, not UTF-16 units */
const pyLen = (s: string): number => Array.from(s).length;

const escapeRe = (s: string): string => s.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");

/** r'\b' + re.escape(k) + r'\b' with Python's \b: a keyword edge that is not a word character needs one beside it. */
const wordRes = new Map<string, RegExp>();
function wordRe(k: string): RegExp {
  let re = wordRes.get(k);
  if (!re) {
    const cps = Array.from(k);
    const before = IS_W.test(cps[0]) ? B0 : `(?<=${W})`;
    const after = IS_W.test(cps[cps.length - 1]) ? B1 : `(?=${W})`;
    re = new RegExp(before + escapeRe(k) + after, "gu");
    wordRes.set(k, re);
  }
  return re;
}

/** str.count(k): non-overlapping, left to right */
function countOf(text: string, k: string): number {
  let n = 0;
  for (let i = text.indexOf(k); i !== -1; i = text.indexOf(k, i + k.length)) n++;
  return n;
}

/* ── the step's functions ──────────────────────────────────────────────── */

// A2\d\.\d{6}(?:\.\d+)? with re.IGNORECASE: Unicode digits, any number of them after the second dot, no edges
const ORDER_RE = new RegExp("A2\\p{Nd}\\.\\p{Nd}{6}(?:\\.\\p{Nd}+)?", "giu");

/**
 * extract_order_numbers: each A2x.xxxxxx(.yyy) once, as written. First seen first - the Python's list(set(...))
 * leaves the order of two or more to its string hashing, which changes from run to run.
 */
export function extractOrderNumbers(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(ORDER_RE), (m) => m[0]))];
}

/** calculate_score: hits per keyword - a one-word keyword between word edges, a phrase as a plain substring. */
export function calculateScore(text: string, keywords: readonly string[]): { score: number; matched: string[] } {
  const lower = text.toLowerCase();
  let score = 0;
  const matched: string[] = [];
  for (const keyword of keywords) {
    const k = keyword.toLowerCase();
    const count = k.includes(" ") ? countOf(lower, k) : (lower.match(wordRe(k)) ?? []).length;
    if (count > 0) {
      matched.push(keyword);
      score += count;
    }
  }
  return { score, matched };
}

const SIGNATURE_TRIGGERS = [
  "mit freundlichen gr", "freundliche gr",
  "kind regards", "best regards",
  "cordialement", "cordiali saluti", "distinti saluti",
  "meilleures salutations",
];
const THANK_YOU = ["vielen dank", "merci", "merci beaucoup", "grazie", "thank you", "thanks"].map((t) => new RegExp(`^${t}${S}*$`, "u"));
const URL_LINE = new RegExp(`^${S}*https?://`, "u");
const WWW_LINE = new RegExp(`^${S}*www\\.`, "u");
const CONTACT_LINE = new RegExp(`^${S}*(?:tel[.:]|phone:|fax:|e-mail:|email:|mobile${S}*:)`, "u");
// \b(gmbh|ag\b|...): gmbh, sarl, srl, ltd, inc and co. have no closing edge - "incorrect" and "co.uk" count
const COMPANY_WORD = new RegExp(`${B0}(?:gmbh|ag${B1}|sa${B1}|sas${B1}|sarl|srl|spa${B1}|ltd|inc|bv${B1}|kg${B1}|co\\.)`, "u");
const RFQ_WORDS = ["bestellung", "anfrage", "im anhang", "in der anlage", "anbei", "offerte", "angebot", "commande", "ordine"];
// on the line as written, case-sensitive; À-Ÿ is U+00C0-U+0178 (lower-case letters included), À-ÿ U+00C0-U+00FF
const COMPANY_LINE = new RegExp(
  `^${S}*[A-Z\\u00c0-\\u0178][A-Za-z\\u00c0-\\u00ff${PY_WS}&\\-]+${S}+(?:GmbH|AG|SA|SAS|SARL|SRL|SPA|Ltd|Inc|BV|KG|Co\\.)`, "u",
);
const DISCLAIMER = /confidentialit|privacy|notice|disclaimer|vertraulich/u;

/**
 * remove_signature_noise: drops, line by line, a greeting and everything after it, a bare "thanks" line and
 * everything after it, links, short phone / e-mail lines, short lines naming a company form (unless they carry
 * an order word), "Name GmbH" lines and disclaimers.
 */
export function removeSignatureNoise(text: string): string {
  if (!text) return text;
  const cleaned: string[] = [];
  let inSignature = false;
  for (const line of text.split("\n")) {
    const lower = pyStrip(line.toLowerCase());
    if (SIGNATURE_TRIGGERS.some((t) => lower.includes(t))) {
      inSignature = true;
      continue;
    }
    if (THANK_YOU.some((re) => re.test(lower))) {
      inSignature = true;
      continue;
    }
    if (inSignature) continue;
    if (URL_LINE.test(lower) || WWW_LINE.test(lower)) continue;
    if (CONTACT_LINE.test(lower) && pyLen(pyStrip(line)) < 80) continue;
    if (COMPANY_WORD.test(lower) && pyLen(pyStrip(line)) < 80 && !RFQ_WORDS.some((k) => lower.includes(k))) continue;
    if (COMPANY_LINE.test(line)) continue;
    if (DISCLAIMER.test(lower)) continue;
    cleaned.push(line);
  }
  return cleaned.join("\n");
}

export type ClassifyResult = {
  cat: string | null;
  /** the sub-category the keywords chose, and the dropdown value it becomes */
  subKey: string | null;
  sub: string | null;
  confidence: number;
  mainMatched: string[];
  subMatched: string[];
  orders: string[];
  scores: Record<string, number>;
  subScores: Record<string, number>;
};

/** classify(title, description): the category with the highest score, then its sub-category likewise. */
export function classify(title: string, description: string): ClassifyResult {
  const combined = `${title} `.repeat(10) + removeSignatureNoise(description);
  const orders = extractOrderNumbers(title + " " + description); // the raw content, signature and all
  const scores: Record<string, number> = {};
  let cat: string | null = null, best = 0, mainMatched: string[] = [];
  for (const [name, data] of Object.entries(KEYWORDS)) {
    const r = calculateScore(combined, data.main);
    scores[name] = r.score;
    if (r.score > best) [cat, best, mainMatched] = [name, r.score, r.matched];
  }
  const subScores: Record<string, number> = {};
  if (cat === null) return { cat, subKey: null, sub: null, confidence: 0, mainMatched: [], subMatched: [], orders, scores, subScores };
  let subKey: string | null = null, subBest = 0, subMatched: string[] = [];
  for (const [name, keywords] of Object.entries(KEYWORDS[cat].sub)) {
    const r = calculateScore(combined, keywords);
    subScores[name] = r.score;
    if (r.score > subBest) [subKey, subBest, subMatched] = [name, r.score, r.matched];
  }
  const sub = subKey === null ? null : DROPDOWN_VALUES[cat]?.[subKey] ?? subKey;
  // round(min(100, total / 3 * 100), 1): only 33.3, 66.7 and 100 can come out, so no half to round
  const confidence = Math.round(Math.min(100, ((mainMatched.length + subMatched.length) / 3) * 100) * 10) / 10;
  return { cat, subKey, sub, confidence, mainMatched, subMatched, orders, scores, subScores };
}

/* ── what the step writes ──────────────────────────────────────────────── */

/** How the step's run ends: "error" = it raises before classifying, "skipped" = subject and content empty. */
export type Status = "classified" | "not_classified" | "skipped" | "error";

export type Classification = {
  status: Status;
  /** enquiry_category as the step writes it; null = it writes nothing at all */
  category: string | null;
  /** the property the sub-category goes to, and its value; null when none is written */
  subProperty: string | null;
  subCategory: string | null;
  /** the sub-category before DROPDOWN_VALUES - three of Delivery's write "Existing Order" */
  subKey: string | null;
  /** order_number as the step writes it: only with a category */
  orderNumber: string | null;
  /** every order number in subject + content, written or not */
  orderNumbers: string[];
  /** each category's score, in KEYWORDS order */
  scores: Record<string, number>;
  /** the chosen category's sub-category scores */
  subScores: Record<string, number>;
  /** the keywords hit, once per listing - the note's "Detected n matching keyword(s)" */
  matched: string[];
  /** the note's confidence */
  confidence: number;
  explanation: string;
};

const zeroScores = (): Record<string, number> => Object.fromEntries(CATEGORIES.map((c) => [c, 0]));

function listed(keywords: string[], n = 5): string {
  const u = [...new Set(keywords)];
  return u.slice(0, n).map((k) => `"${k}"`).join(", ") + (u.length > n ? ` and ${u.length - n} more` : "");
}

function explain(r: ClassifyResult, orderNumber: string | null): string {
  if (r.cat === null) return "No keyword of any category in the subject or the cleaned content: nothing is written, not even an order number.";
  const best = r.scores[r.cat];
  let next: string | null = null;
  for (const c of CATEGORIES) if (c !== r.cat && (next === null || r.scores[c] > r.scores[next])) next = c;
  const rival = next === null || r.scores[next] === 0 ? "" : r.scores[next] === best
    ? ` - tied with ${next}, the first in list order wins` : `; next ${next} at ${r.scores[next]}`;
  const sub = r.subKey === null ? "no sub-category keyword, so none is written"
    : `sub-category ${r.sub} ("${r.subKey}", score ${r.subScores[r.subKey]}) on ${listed(r.subMatched)}`;
  return `${r.cat} (score ${best}${rival}) on ${listed(r.mainMatched)}; ${sub}${orderNumber ? `; order_number ${orderNumber}` : ""}.`;
}

/**
 * The step's main() for one ticket, without HubSpot: what it writes and why. `subject` / `content` as HubSpot
 * returns them - a property that is missing reads "", one that comes back null makes the Python raise a
 * TypeError (title[:60], len(description)) before classifying, so nothing is written.
 */
export function classifyTicket(input: { subject?: string | null; content?: string | null }): Classification {
  const title = input.subject === undefined ? "" : input.subject;
  const description = input.content === undefined ? "" : input.content;
  const none = (status: Status, explanation: string): Classification => ({
    status, category: null, subProperty: null, subCategory: null, subKey: null, orderNumber: null, orderNumbers: [],
    scores: zeroScores(), subScores: {}, matched: [], confidence: 0, explanation,
  });
  if (title === null || description === null) {
    return none("error", `The ${title === null ? "subject" : "content"} is null: the step raises a TypeError and writes nothing.`);
  }
  if (!title && !description) return none("skipped", "Subject and content are empty: the step skips the ticket.");
  const r = classify(title, description);
  const subProperty = r.cat !== null && r.sub ? PROPERTY_MAPPING.sub_categories[r.cat] ?? null : null;
  const orderNumber = r.cat !== null && r.orders.length ? r.orders.join(", ") : null;
  return {
    status: r.cat === null ? "not_classified" : "classified",
    category: r.cat,
    subProperty,
    subCategory: subProperty ? r.sub : null,
    subKey: r.subKey,
    orderNumber,
    orderNumbers: r.orders,
    scores: r.scores,
    subScores: r.subScores,
    matched: [...r.mainMatched, ...r.subMatched],
    confidence: r.confidence,
    explanation: explain(r, orderNumber),
  };
}
