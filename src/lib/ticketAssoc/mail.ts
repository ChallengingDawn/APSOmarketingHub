// "PLEASE CHECK YOUR TICKET" - the mail Ticket associations sends a ticket's owner when the customer
// has ordered an article from their open ESO / TSA ticket after it was opened (SARCLA, 17.10.2026).
// One function renders it, for the real mail and for Settings > Mail's preview alike.

import { esc, wrap } from "@/lib/notify/mailer";

export type OrderAlertMail = {
  ownerName: string | null;
  ticketSubject: string | null;
  ticketUrl: string;
  orderNumber: string;
  orderDate: string | null;
  articles: string[];
  company: string | null;
  hubUrl: string;
};

export const SAMPLE_ORDER_ALERT: OrderAlertMail = {
  ownerName: "Anna", ticketSubject: "Offer request O-rings NBR 70", ticketUrl: "https://app-eu1.hubspot.com/contacts/26492587/record/0-5/0",
  orderNumber: "A26.123456.000", orderDate: "2026-10-17", articles: ["1120030724"], company: "Muster AG", hubUrl: "https://apsomarketinghub-dev.awssandbox.angst-pfister.com",
};

const row = (k: string, v: string) =>
  `<tr><td style="padding:6px 12px 6px 0;color:#8b97ac;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-size:14px;color:#15223a">${esc(v)}</td></tr>`;

export function renderOrderAlert(m: OrderAlertMail): { subject: string; html: string; text: string } {
  const subject = `Please check your ticket - an order was detected: ${m.ticketSubject ?? m.orderNumber}`.slice(0, 160);
  const greeting = m.ownerName ? `Hello ${m.ownerName},` : "Hello,";
  const intro = `${greeting} the system detected an order on your ticket: the customer ordered an article from it after the ticket was opened. The order is now linked to the ticket.`;
  const lines: [string, string][] = [
    ["Ticket", m.ticketSubject ?? "-"],
    ...(m.company ? [["Customer", m.company] as [string, string]] : []),
    ["Order", m.orderNumber],
    ...(m.orderDate ? [["Placed", m.orderDate] as [string, string]] : []),
    ["Article", m.articles.join(", ")],
  ];
  const html = wrap({
    heading: "Please check your ticket",
    intro,
    rows: `<table style="border-collapse:collapse">${lines.map(([k, v]) => row(k, v)).join("")}</table>`,
    cta: { label: "Review it", href: m.ticketUrl },
    hubUrl: m.hubUrl,
    footer: "Sent by APSOhub's Ticket/order/article associations because an order matched your open ESO / TSA ticket. An admin can switch these mails off in the hub (UC & HubSpot Apps > Ticket/order/article associations > Order alerts).",
  });
  const text = [
    "Please check your ticket",
    "",
    intro,
    "",
    ...lines.map(([k, v]) => `${k}: ${v}`),
    "",
    `Review it: ${m.ticketUrl}`,
  ].join("\n");
  return { subject, html, text };
}
