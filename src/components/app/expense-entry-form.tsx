"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type ExpenseEntryFormProps = {
  categories: string[];
  today: string;
};

type ExpenseDraft = {
  selected: boolean;
  payee: string;
  amount: string;
  tax: string;
  reference: string;
  notes: string;
};

const paidFromOptions = ["Cash", "M-Pesa", "Bank", "Petty cash", "Owner paid personally", "Other"];

function numberValue(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return `KES ${Math.round(value).toLocaleString("en-KE")}`;
}

export function ExpenseEntryForm({ categories, today }: ExpenseEntryFormProps) {
  const [search, setSearch] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [paidFrom, setPaidFrom] = useState("Cash");
  const [reportPeriod, setReportPeriod] = useState("Daily Expense Report");
  const [drafts, setDrafts] = useState<Record<number, ExpenseDraft>>({});

  const rows = useMemo(() => categories.map((category, index) => ({ category, index })), [categories]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    const selectedRows = rows.filter((row) => drafts[row.index]?.selected);
    const matchedRows = rows.filter((row) => row.category.toLowerCase().includes(term));
    return [...selectedRows, ...matchedRows].filter(
      (row, index, list) => list.findIndex((item) => item.index === row.index) === index,
    );
  }, [drafts, rows, search]);

  const selectedRows = rows.filter((row) => drafts[row.index]?.selected && numberValue(drafts[row.index]?.amount ?? "") > 0);
  const amountSpent = selectedRows.reduce((sum, row) => sum + numberValue(drafts[row.index]?.amount ?? ""), 0);
  const inputTax = selectedRows.reduce((sum, row) => sum + numberValue(drafts[row.index]?.tax ?? ""), 0);

  function updateDraft(index: number, patch: Partial<ExpenseDraft>) {
    setDrafts((current) => ({
      ...current,
      [index]: {
        selected: current[index]?.selected ?? false,
        payee: current[index]?.payee ?? "",
        amount: current[index]?.amount ?? "",
        tax: current[index]?.tax ?? "",
        reference: current[index]?.reference ?? "",
        notes: current[index]?.notes ?? "",
        ...patch,
      },
    }));
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="document" value={reportPeriod} />
      <input type="hidden" name="field_expense_line_count" value={rows.length} />
      <input type="hidden" name="label_expense_line_count" value="Expense line count" />
      <input type="hidden" name="field_expense_date" value={expenseDate} />
      <input type="hidden" name="label_expense_date" value="Expense date" />
      <input type="hidden" name="field_paid_from" value={paidFrom} />
      <input type="hidden" name="label_paid_from" value="Paid from" />
      <input type="hidden" name="field_report_period" value={reportPeriod} />
      <input type="hidden" name="label_report_period" value="Report period" />
      <input type="hidden" name="field_total_paid" value={amountSpent.toFixed(2)} />
      <input type="hidden" name="label_total_paid" value="Total amount spent" />
      <input type="hidden" name="field_input_tax" value={inputTax.toFixed(2)} />
      <input type="hidden" name="label_input_tax" value="Input VAT" />

      {rows.map((row) => {
        const draft = drafts[row.index];
        return (
          <div key={row.index} className="hidden">
            <input type="hidden" name={`field_line_${row.index}_selected`} value={draft?.selected ? "yes" : "no"} />
            <input type="hidden" name={`field_line_${row.index}_category`} value={row.category} />
            <input type="hidden" name={`field_line_${row.index}_payee`} value={draft?.payee ?? ""} />
            <input type="hidden" name={`field_line_${row.index}_amount`} value={draft?.amount ?? ""} />
            <input type="hidden" name={`field_line_${row.index}_tax`} value={draft?.tax ?? ""} />
            <input type="hidden" name={`field_line_${row.index}_reference`} value={draft?.reference ?? ""} />
            <input type="hidden" name={`field_line_${row.index}_notes`} value={draft?.notes ?? ""} />
          </div>
        );
      })}

      <section className="grid gap-3 lg:grid-cols-[170px_190px_1fr_180px]">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Expense date
          <input
            type="date"
            value={expenseDate}
            onChange={(event) => setExpenseDate(event.target.value)}
            className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Paid from
          <select
            value={paidFrom}
            onChange={(event) => setPaidFrom(event.target.value)}
            className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-900"
          >
            {paidFromOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="relative grid gap-1 text-sm font-semibold text-slate-700">
          Search expense
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-11 w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-slate-900"
              placeholder="Fuel, wages, rent..."
            />
          </span>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Report to open
          <select
            value={reportPeriod}
            onChange={(event) => setReportPeriod(event.target.value)}
            className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-900"
          >
            <option>Daily Expense Report</option>
            <option>Weekly Expense Report</option>
            <option>Monthly Expense Report</option>
            <option>Annual Expense Report</option>
          </select>
        </label>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Selected expenses</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{selectedRows.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Amount spent</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{money(amountSpent)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Input VAT noted</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{money(inputTax)}</p>
        </div>
      </section>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[1120px] w-full border-collapse bg-white text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-12 px-3 py-3">Use</th>
              <th className="px-3 py-3">Expense</th>
              <th className="px-3 py-3">Paid to</th>
              <th className="px-3 py-3">Amount spent</th>
              <th className="px-3 py-3">Input VAT</th>
              <th className="px-3 py-3">Reference</th>
              <th className="px-3 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const draft = drafts[row.index];
              return (
                <tr key={row.index} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={draft?.selected ?? false}
                      onChange={(event) => updateDraft(row.index, { selected: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{row.category}</td>
                  <td className="px-3 py-2">
                    <input
                      value={draft?.payee ?? ""}
                      onChange={(event) => updateDraft(row.index, { payee: event.target.value, selected: true })}
                      className="min-h-10 w-full rounded-md border border-slate-300 px-3"
                      placeholder="Who was paid?"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={draft?.amount ?? ""}
                      onChange={(event) => updateDraft(row.index, { amount: event.target.value, selected: true })}
                      className="min-h-10 w-full rounded-md border border-slate-300 px-3"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={draft?.tax ?? ""}
                      onChange={(event) => updateDraft(row.index, { tax: event.target.value, selected: true })}
                      className="min-h-10 w-full rounded-md border border-slate-300 px-3"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={draft?.reference ?? ""}
                      onChange={(event) => updateDraft(row.index, { reference: event.target.value, selected: true })}
                      className="min-h-10 w-full rounded-md border border-slate-300 px-3"
                      placeholder="Receipt no."
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={draft?.notes ?? ""}
                      onChange={(event) => updateDraft(row.index, { notes: event.target.value, selected: true })}
                      className="min-h-10 w-full rounded-md border border-slate-300 px-3"
                      placeholder="Short note"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">
          Tick each expense paid today, enter the amount, then post once. Solva saves every selected line as a posted office expense.
        </p>
        <button
          name="intent"
          value="Record expenses"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm"
        >
          Record expenses and generate report
        </button>
      </div>
    </div>
  );
}
