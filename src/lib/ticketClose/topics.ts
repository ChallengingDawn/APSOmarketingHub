// The Enquiry Category topics for a Back Office ticket nobody asked anything in (SARCLA 26.10.2026: "we should be able
// to recognise 100%"; "the sentiment tab already detects the machines, here we just need to transpose to enquiry
// category"; "also write in HubSpot but the new options are hidden"). They are hidden options of enquiry_category, so
// nobody picks them by hand; the hub sets them when a ticket closes on "Others" or empty and the sentiment sweep's
// sentiment_not_valid_reason says what it is. No imports: the Detection page reads this too.

export const TOPIC = {
  internal: "Internal e-mail",
  automatic: "Automatic e-mail",
  empty: "Empty e-mail",
  /** a hidden option HubSpot already had (596 Back Office tickets on 26.10.2026) */
  ms365: "MS365",
} as const;

/** The three hidden options the hub added - the only categories besides Others/empty it may later replace. */
export const HIDDEN_TOPICS: readonly string[] = [TOPIC.internal, TOPIC.automatic, TOPIC.empty];
/** Every topic a sentiment flag gives - a ticket on one of these says what it is, not what was asked. */
export const FLAG_TOPICS: readonly string[] = [...HIDDEN_TOPICS, TOPIC.ms365];

/**
 * sentiment_not_valid_reason -> the topic: a person of ours, or a shared or country mailbox people write from, is
 * internal; our systems' templated mail (PERFORMIS, Finance, AVOR, PDM, LVS - same subject shape every time) and every
 * robot automatic. Not here, so the AI reads them: an order confirmation (a customer's own order may need a
 * Delivery answer).
 */
export const FLAG_TOPIC: Readonly<Record<string, string>> = {
  mail_from_colleague: TOPIC.internal,
  from_mailbox: TOPIC.internal,
  only_our_own_words: TOPIC.internal,
  no_inbound_mail: TOPIC.internal,
  from_performis: TOPIC.automatic,
  from_finance: TOPIC.automatic,
  from_avor: TOPIC.automatic,
  from_lvs: TOPIC.automatic,
  from_pdm: TOPIC.automatic,
  bulk_mail: TOPIC.automatic,
  newsletter: TOPIC.automatic,
  mail_from_noreply: TOPIC.automatic,
  auto_reply: TOPIC.automatic,
  bounce: TOPIC.automatic,
  shipping_notification: TOPIC.automatic,
  erp_stale_warning: TOPIC.automatic,
  anyseals: TOPIC.automatic,
  directcut: TOPIC.automatic,
  doc_declaration: TOPIC.automatic,
  new_registrant: TOPIC.automatic,
  model_says_machine: TOPIC.automatic,
  from_ms365: TOPIC.ms365,
  mail_had_no_words: TOPIC.empty,
};
