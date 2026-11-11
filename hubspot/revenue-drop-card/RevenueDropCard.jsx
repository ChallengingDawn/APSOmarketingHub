// THE REVENUE DROP CARD ON A UC12 TICKET - one more card in the hub's HubSpot app, on the ticket's Sales Teams tab
// beside the Erosion card (Diana 11.11.2026: "a card built on apsomarketing hub like the erosion tickets have"). The
// ticket's description is the day it was written; this card is today: the change then against the change now, what
// came in since, 24 months of revenue plus order intake, and revenue by profit center. Everything comes from HubSpot -
// the ticket's Revenue drop fields and its company's monthly fields ("take all info from hubspot so we dont need to
// grab it from apsohub"); the figures are worked out in revenueDropFigures.ts. On any other ticket it draws nothing.
import React, { useEffect, useMemo, useState } from "react";
import {
  hubspot, BarChart, Divider, EmptyState, ErrorState, Flex, Heading, LoadingSpinner, Statistics, StatisticsItem,
  StatisticsTrend, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag, Text,
} from "@hubspot/ui-extensions";
import { useAssociations } from "@hubspot/ui-extensions/crm";
import { TICKET_PROPS, companyProps, figuresOf, keyOf } from "./revenueDropFigures";

hubspot.extend(({ actions }) => <RevenueDropCard fetchProperties={actions.fetchCrmObjectProperties} />);

const amount = (n) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")} EUR`;
const pct = (x) => (x == null ? "-" : `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`);
const TAG = { lost: "error", down: "warning", back: "success" };
const today = () => new Date().toISOString().slice(0, 10);

function RevenueDropCard({ fetchProperties }) {
  // undefined: reading the ticket · null: no UC12 ticket · else its Revenue drop fields
  const [ticket, setTicket] = useState(undefined);
  useEffect(() => {
    fetchProperties(TICKET_PROPS).then((p) => setTicket(keyOf(p?.revenue_drop_key) ? p : null)).catch(() => setTicket(null));
  }, []);
  if (ticket === null) return null;
  if (ticket === undefined) return <LoadingSpinner label="Reading the ticket" />;
  return <Figures ticket={ticket} />;
}

function Figures({ ticket }) {
  const props = useMemo(() => companyProps(Number(today().slice(0, 4))), []);
  const { results, error, isLoading } = useAssociations({ toObjectType: "0-2", properties: props, pageLength: 1 });
  if (isLoading) return <LoadingSpinner label="Reading the company" />;
  if (error) return <ErrorState title="The company could not be read"><Text>{String(error?.message ?? error)}</Text></ErrorState>;
  const company = results?.[0]?.properties;
  if (!company) return <EmptyState title="No company on this ticket" layout="vertical"><Text>Link the company to see its figures.</Text></EmptyState>;

  const c = figuresOf(ticket, company, today());
  if (!c) return null;
  return (
    <Flex direction="column" gap="medium">
      <Flex direction="row" justify="between" align="center" wrap="wrap" gap="small">
        <Flex direction="column" gap="flush">
          <Heading>Revenue drop · today</Heading>
          <Text variant="microcopy">Revenue plus order intake to {c.today.window.split(" - ")[1]}{c.asOf ? ` · ERP figures as of ${c.asOf}` : ""}</Text>
        </Flex>
        <Tag variant={TAG[c.status]}>{c.statusText}</Tag>
      </Flex>

      <Statistics>
        <StatisticsItem label="When the ticket was written" number={pct(c.ticket.change)}>
          <Text>{amount(c.ticket.last)} against {amount(c.ticket.prev)} · {c.ticket.window}</Text>
        </StatisticsItem>
        <StatisticsItem label="Today" number={pct(c.today.change)}>
          {c.points != null && c.points !== 0 && (
            <StatisticsTrend direction={c.points > 0 ? "increase" : "decrease"} value={`${Math.abs(c.points)} points ${c.points > 0 ? "better" : "worse"}`} />
          )}
          <Text>{amount(c.today.last)} against {amount(c.today.prev)} · {c.today.window}</Text>
        </StatisticsItem>
        <StatisticsItem label="Since the ticket" number={c.since ? amount(c.since.total) : "-"}>
          <Text>{c.since ? `revenue ${amount(c.since.rev)} + order intake ${amount(c.since.oi)}` : "No month has passed yet"}</Text>
        </StatisticsItem>
      </Statistics>

      <BarChart
        data={c.months.map((m) => ({ month: m.label, value: Math.round(m.value), when: m.after ? "Since the ticket" : "Before the ticket" }))}
        axes={{
          x: { field: "month", fieldType: "category", label: "Month" },
          y: { field: "value", fieldType: "linear", label: "Revenue plus order intake (EUR)" },
          options: { groupFieldByColor: "when" },
        }}
        options={{ title: "Revenue plus order intake per month", showLegend: true }}
      />

      {c.pcs.length > 0 && (
        <Table bordered={true}>
          <TableHead>
            <TableRow>
              <TableHeader>Profit center</TableHeader>
              <TableHeader>12 months before the ticket</TableHeader>
              <TableHeader>Last 12 months</TableHeader>
              <TableHeader>Change</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {c.pcs.map((p) => (
              <TableRow key={p.code}>
                <TableCell>{p.label}</TableCell>
                <TableCell>{amount(p.before)}</TableCell>
                <TableCell>{amount(p.last)}</TableCell>
                <TableCell>{pct(p.change)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Divider />
      <Text variant="microcopy">
        {[c.lastOrder ? `Last order ${c.lastOrder}` : null, c.major ? `Major profit center ${c.major}` : null].filter(Boolean).join(" · ")}
      </Text>
    </Flex>
  );
}
