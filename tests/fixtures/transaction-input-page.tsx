"use client";

import { MultiLineTransactionForm } from "@/components/app/multi-line-transaction-form";
import { PersistedForm } from "@/components/app/persisted-form";
import { useState } from "react";

const products = Array.from({ length: 300 }, (_, index) => ({ id: `p${index}`, name: `Test product ${index}`, code: `SKU-${index}`, price: 950, available: 100, vatRate: 16, vatCode: "VAT_STD", trackInventory: true }));

export default function NumberEntryFixture() {
  const [mode, setMode] = useState<"sale" | "goods-received">("sale");
  return <><button onClick={() => setMode(mode === "sale" ? "goods-received" : "sale")}>Switch mode</button><PersistedForm key={mode} draftKey={`qa-${mode}`} confirmRestoreMessage="Continue saved transaction?"><MultiLineTransactionForm mode={mode} products={products} today="2026-10-23" /></PersistedForm></>;
}
