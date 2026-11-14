"use client";
import React from "react";
import Box from "@mui/material/Box";
import PageHeader from "../../PageHeader";
import SupplierTrendPanel from "../SupplierTrendPanel";

export default function Page() {
  return (
    <Box>
      <PageHeader icon="trend" eyebrow="Purchasing" title="Supplier Price Index"
        subtitle="Follow each supplier's purchase prices over time — a constant-basket index per material and form, built from the ingested price lists. The buy-side mirror of the competitor price-index." />
      <SupplierTrendPanel />
    </Box>
  );
}
