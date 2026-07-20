import { distributionReports } from "./distribution";

export const distributionSummary = {
  deliveryValueToday: "KES 0.00",
  completionRate: "Not enough data yet",
  onTimeDeliveryRate: "Not enough data yet",
  collectionsReceived: "KES 0.00",
  unreconciledCash: "KES 0.00",
  failedDeliveries: 0,
  routeExpenses: "KES 0.00",
  vehicleStockValue: "KES 0.00",
  customerPackagingBalances: "0",
  cratesOutstanding: "0",
  majorExceptions: 0,
  plannedRunsToday: 0,
};

export const distributionWorkflows = [
  { title: "Delivery planning", href: "/distribution/planning", description: "Group approved orders into delivery runs, assign routes, vehicles and drivers, and sequence stops." },
  { title: "Delivery runs", href: "/distribution/runs", description: "Manage run approval, loading, dispatch, in-progress delivery, return to depot and closure." },
  { title: "Loading sheets", href: "/distribution/loading", description: "Pick, verify and load products using FEFO, batches, serials, pack units and vehicle stock." },
  { title: "Dispatch", href: "/distribution/dispatch", description: "Confirm driver, vehicle, documents, odometer, fuel and stock movements before departure." },
  { title: "Driver mobile", href: "/distribution/mobile", description: "Phone-first stops, arrival, delivery confirmation, proof, collections, returns and crates." },
  { title: "Route sales", href: "/distribution/route-sales", description: "Load planned stock, sell from vehicle, collect payments, issue receipts and reconcile unsold stock." },
  { title: "Collections", href: "/distribution/collections", description: "Track cash, M-Pesa, cheque, deposits, partial payments, shortfalls and driver custody." },
  { title: "Reconciliation", href: "/distribution/reconciliation", description: "Close vehicle stock, cash, expenses, returns, proof and packaging variances." },
  { title: "Crates and empties", href: "/distribution/packaging", description: "Track customer and vehicle returnable packaging balances, deposits, losses and damage." },
  { title: "Exceptions", href: "/distribution/exceptions", description: "Resolve failed stops, proof gaps, payment shortfalls, stock, cash and packaging variances." },
  { title: "Timeline", href: "/distribution/timeline", description: "Review run, route, vehicle, driver, customer and stop events from planning to close." },
  { title: "Reports", href: "/distribution/reports", description: `${distributionReports.length} route, delivery, vehicle, driver, stock, cash and packaging reports.` },
];

export const planningViews = ["List view", "Route view", "Calendar view", "Manual sequence editor"];

export const dispatchChecks = [
  "Delivery run approved",
  "Vehicle active",
  "Driver active",
  "Licence and vehicle documents valid",
  "Loading verified",
  "Required stock loaded",
  "Delivery notes prepared",
  "Payment float recorded",
  "Approvals complete",
];

export const mobileActions = [
  "Confirm arrival",
  "Confirm quantities",
  "Record rejection",
  "Capture signature",
  "Take photo",
  "Record payment",
  "Record crates",
  "Complete stop",
];

export const closureChecks = [
  "Stops completed or rescheduled",
  "Vehicle returned",
  "Stock reconciled",
  "Returns recorded",
  "Crates reconciled",
  "Cash reconciled",
  "Proof complete",
  "Exceptions resolved or accepted",
  "Approvals complete",
];
