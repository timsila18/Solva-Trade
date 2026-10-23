import { CustomerInvoiceSearch } from "@/components/app/customer-invoice-search";

const items = ["Ken Mwangangi", "Kennedy", "Karen", "Ahmed", "Mike Ken", "Kévin"].map((name, index) => ({
  id: String(index), customerName: name, invoiceNumber: `INV-${index + 1}`, otherDetails: `2026-10-23 ${1000 + index}`,
  content: <article><p>{name}</p><p>KES {1000 + index}</p><a href={`/api/exports?invoiceId=${index}`}>Invoice</a></article>,
}));

export default function InvoiceSearchFixture() {
  return <><section><CustomerInvoiceSearch label="Search Sales History" items={items} /></section><section><CustomerInvoiceSearch label="Search pending invoices" items={items} /></section></>;
}
