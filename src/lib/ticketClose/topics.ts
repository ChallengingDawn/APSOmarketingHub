// The Enquiry Category topics for a Back Office ticket nobody asked anything in (SARCLA 26.10.2026: "we should be able
// to recognise 100%"; "the sentiment tab already detects the machines, here we just need to transpose to enquiry
// category"; "also write in HubSpot but the new options are hidden"). They are hidden options of enquiry_category, so
// nobody picks them by hand; the hub sets them when a ticket closes on "Others" or empty and the sentiment sweep's
// sentiment_not_valid_reason says what it is. No imports: the Detection page reads this too.

export const TOPIC = {
  internal: "Internal e-mail",
  automatic: "Automatic e-mail",
  empty: "Empty e-mail",
  /** SARCLA 26.10.2026: "this should be even separate - Finance email and AVOR emails" */
  finance: "Finance e-mail",
  avor: "AVOR e-mail",
  /**
   * the AI's answer for mail from outside that asks nothing: advertising, spam, surveys, job applications, IT notices
   * (SARCLA 26.10.2026, after 6 of 10 sampled "customer" Others were exactly that)
   */
  spam: "Spam or advertising",
  /** a Task Status Report no GQS task could be found for (gqs.ts) - SARCLA 27.10.2026 */
  gqs: "GQS task update",
  /** a hidden option HubSpot already had (596 Back Office tickets on 26.10.2026) */
  ms365: "MS365",
} as const;

/** The hidden options the hub added - the only categories besides Others/empty it may later replace. */
export const HIDDEN_TOPICS: readonly string[] = [TOPIC.internal, TOPIC.automatic, TOPIC.finance, TOPIC.avor, TOPIC.empty, TOPIC.spam, TOPIC.gqs];

/**
 * A customer asking APSOparts to register as its supplier (a supplier portal, a code of conduct to sign, supplier forms):
 * SARCLA 27.10.2026 "supplier registration should go to account requests" - chose the existing Product Information with
 * the sub-category "Self-declaration APSO for supplier creation", which lives on the SECOND Product Information property.
 */
export const SUPPLIER = {
  topic: "Supplier registration",
  category: "Product Information",
  prop: "enquiry_sub_category___product_information___2",
  value: "Self-declaration APSO for supplier creation",
} as const;
/** Every topic a sentiment flag gives - a ticket on one of these says what it is, not what was asked. */
export const FLAG_TOPICS: readonly string[] = [TOPIC.internal, TOPIC.automatic, TOPIC.finance, TOPIC.avor, TOPIC.empty, TOPIC.ms365];

/**
 * sentiment_not_valid_reason -> the topic: a person of ours, or a shared or country mailbox people write from, is
 * internal; Finance's and AVOR's templated mail each its own topic; our other systems (PERFORMIS, PDM, LVS - same
 * subject shape every time) and every robot automatic. Not here, so the AI reads them: an order confirmation (a customer's own order may need a
 * Delivery answer).
 */
export const FLAG_TOPIC: Readonly<Record<string, string>> = {
  mail_from_colleague: TOPIC.internal,
  from_mailbox: TOPIC.internal,
  only_our_own_words: TOPIC.internal,
  no_inbound_mail: TOPIC.internal,
  from_performis: TOPIC.automatic,
  from_finance: TOPIC.finance,
  from_avor: TOPIC.avor,
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
