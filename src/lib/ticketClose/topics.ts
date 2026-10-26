// The Enquiry Category topics for a Back Office ticket nobody asked anything in (SARCLA 26.10.2026: "we should be able
// to recognise 100%"; "the sentiment tab already detects the machines, here we just need to transpose to enquiry
// category"; "also write in HubSpot but the new options are hidden"). They are hidden options of enquiry_category, so
// nobody picks them by hand; the hub sets them when a ticket closes on "Others" or empty and the sentiment sweep's
// sentiment_not_valid_reason says what it is. No imports: the Detection page reads this too.

export const TOPIC = {
  internal: "Internal e-mail",
  automatic: "Automatic e-mail",
  empty: "Empty e-mail",
} as const;

/** The three hidden topics, as written in HubSpot. */
export const HIDDEN_TOPICS: readonly string[] = Object.values(TOPIC);

/**
 * sentiment_not_valid_reason -> the topic. Not here, so the AI reads them: an order confirmation (a customer's own
 * order may need a Delivery answer).
 */
export const FLAG_TOPIC: Readonly<Record<string, string>> = {
  mail_from_colleague: TOPIC.internal,
  only_our_own_words: TOPIC.internal,
  no_inbound_mail: TOPIC.internal,
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
  mail_had_no_words: TOPIC.empty,
};
