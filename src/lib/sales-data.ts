export const salesSummary = {
  activeCustomers: 0,
  approvedOrdersReadyForDelivery: 0,
  openInvoices: 0,
  customerBalance: "KES 0.00",
  debtorAgeing: "KES 0.00",
  paymentsToday: "KES 0.00",
};

export const customerSetupSections = [
  "Identity",
  "Contacts",
  "Addresses",
  "Route Assignment",
  "Price Level",
  "Credit Terms",
  "Tax Details",
  "Packaging Account",
];

export const salesWorkflows = [
  { title: "Quotations", href: "/sales/quotations", description: "Prepare customer quotations before converting accepted offers into sales orders." },
  { title: "Sales orders", href: "/sales/orders", description: "Approve customer demand and mark ready orders for delivery planning." },
  { title: "Invoices", href: "/sales/invoices", description: "Issue invoices, track delivery status and feed customer balances." },
  { title: "Customer payments", href: "/sales/payments", description: "Record payments and allocations that distribution collections can reuse." },
  { title: "Customer returns", href: "/sales/returns", description: "Prepare return and credit workflows for rejected or returned delivery items." },
  { title: "Debtor ageing", href: "/sales/debtor-ageing", description: "Monitor outstanding customer balances by due-date bucket." },
];
