import { Banknote } from "lucide-react";
import { EmptyState, MetricCard, PageHero, PlainCard } from "@/components/ui/premium";
import { treasurySummary, treasuryWorkflows } from "@/lib/treasury-data";

const cards = [
  ["Cash available", treasurySummary.totalCashAvailable, "How much usable money the business has right now."],
  ["Bank money", treasurySummary.bankBalances, "Balances from bank accounts and statements."],
  ["M-Pesa money", treasurySummary.mpesaBalances, "Mobile-money collections and payments."],
  ["Driver cash", treasurySummary.cashHeldByDrivers, "Money held after deliveries and collections."],
  ["Cash moving", treasurySummary.cashInTransit, "Transfers not yet confirmed."],
  ["Unidentified money in", treasurySummary.unidentifiedReceipts.toString(), "Receipts that need matching to a customer or reason."],
  ["Needs checking", treasurySummary.unreconciledTransactions.toString(), "Transactions not yet matched to statements."],
  ["Staff advances", treasurySummary.staffAdvancesOutstanding, "Money owed back by staff."],
];

export default function CashBankPage() {
  return (
    <div className="pb-24">
      <PageHero
        eyebrow="Cash and Bank"
        title="See money in, money out, and what still needs checking."
        description="Track cash, bank, M-Pesa, expenses, transfers and reconciliations without forcing owners to think like accountants."
        primaryAction={{ label: "Record Payment", href: "/cash-bank/receipts", icon: Banknote }}
        secondaryAction={{ label: "Reconcile Account", href: "/cash-bank/reconciliation" }}
        insight="I will flag unmatched M-Pesa references, unusual expenses and collection gaps before they become hard to explain."
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, story], index) => (
          <MetricCard key={label} label={label} value={value} story={story} tone={index >= 5 ? "warning" : "neutral"} />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {treasuryWorkflows.map((workflow) => (
          <PlainCard key={workflow.href} href={workflow.href} title={workflow.title} description={workflow.description} action="Open" />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <EmptyState
          title="No money movement yet"
          description="Record the first customer payment, supplier payment or expense so Solva can show your cash position."
          action={{ label: "Record First Payment", href: "/cash-bank/receipts" }}
        />
        <EmptyState
          title="No statements checked yet"
          description="When bank or M-Pesa statements are imported, Solva will help match them to business records."
          action={{ label: "Start Reconciliation", href: "/cash-bank/reconciliation" }}
        />
      </section>
    </div>
  );
}
