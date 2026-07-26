import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function localEnv() {
  const text = fs.readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    env[line.slice(0, index)] = line.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = localEnv();
const email = process.env.SOLVA_QA_EMAIL || "cymereg@solvatrade.co.ke";
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: userPage, error: userError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (userError) throw userError;

const user = userPage.users.find((item) => item.email === email);
console.log(`user: ${user ? "found" : "missing"} ${user?.email_confirmed_at ? "confirmed" : "not-confirmed"}`);
if (!user) process.exit(1);

const { data: memberships, error: membershipError } = await supabase
  .from("business_memberships")
  .select("id,business_id,role,active")
  .eq("user_id", user.id)
  .eq("active", true);
if (membershipError) throw membershipError;
console.log(`active memberships: ${memberships.length}`);
for (const membership of memberships) console.log(`- ${membership.business_id} ${membership.role}`);

const businessId = memberships[0]?.business_id;
if (!businessId) process.exit(1);

const tables = [
  "businesses",
  "customers",
  "products",
  "sales_invoices",
  "customer_payments",
  "goods_received_notes",
  "inventory_movements",
  "fifo_cost_layers",
  "workflow_records",
];

for (const table of tables) {
  const query = supabase.from(table).select("*", { count: "exact", head: true });
  if (table === "businesses") query.eq("id", businessId);
  else query.eq("business_id", businessId);
  const { count, error } = await query;
  console.log(`${table}: ${error ? `ERROR ${error.message}` : count}`);
}

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const { data: invoices, error: invoiceError } = await supabase
  .from("sales_invoices")
  .select("invoice_number,invoice_date,total_amount,balance_due,status,created_at")
  .eq("business_id", businessId)
  .eq("invoice_date", today)
  .order("created_at", { ascending: false })
  .limit(5);
if (invoiceError) throw invoiceError;
console.log(`today invoices: ${invoices.length}`);
for (const invoice of invoices) {
  console.log(`- ${invoice.invoice_number} ${invoice.invoice_date} total=${invoice.total_amount} balance=${invoice.balance_due} status=${invoice.status}`);
}

const { data: recentGrns, error: grnError } = await supabase
  .from("goods_received_notes")
  .select("grn_number,receipt_date,status,created_at")
  .eq("business_id", businessId)
  .order("created_at", { ascending: false })
  .limit(5);
if (grnError) throw grnError;
console.log(`recent GRNs: ${recentGrns.length}`);
for (const grn of recentGrns) console.log(`- ${grn.grn_number} ${grn.receipt_date} ${grn.status}`);
