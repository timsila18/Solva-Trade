export const RECEIVED_PAYMENT_STATUSES = ["posted", "verified", "allocated", "partially_allocated"];

export type CollectedPayment = { id: string; payment_date: string | null; created_at?: string; amount_received: number | string | null; status: string | null };

export function collectedPayments(payments: CollectedPayment[], start: string, end: string) {
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  const seen = new Set<string>();
  let amount = 0;
  let count = 0;
  for (const payment of payments) {
    const timestamp = Date.parse(payment.payment_date || payment.created_at || "");
    if (seen.has(payment.id) || !RECEIVED_PAYMENT_STATUSES.includes(payment.status || "") || !(timestamp >= startTime && timestamp < endTime)) continue;
    seen.add(payment.id);
    amount += Number(payment.amount_received) || 0;
    count++;
  }
  return { amount: Math.round(amount * 100) / 100, count };
}

export function productSalesPeriod(period: string, date: string, from?: string | null, to?: string | null) {
  const valid = (value: string | null | undefined): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
  if (!valid(date)) throw new Error("Choose a valid report date.");
  if (period === "custom") {
    if (!valid(from) || !valid(to) || from > to) throw new Error("Choose valid From and To dates, with From no later than To.");
    return { start: from, end: to, label: `${from} to ${to}` };
  }
  const start = new Date(`${date}T00:00:00Z`);
  const end = new Date(start);
  if (period === "weekly") { start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7); end.setTime(start.getTime()); end.setUTCDate(end.getUTCDate() + 6); }
  else if (period === "monthly") { start.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0); }
  else if (period === "yearly") { start.setUTCMonth(0, 1); end.setUTCMonth(11, 31); }
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  return { start: startDate, end: endDate, label: startDate === endDate ? startDate : `${startDate} to ${endDate}` };
}
