import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  if (!fs.existsSync(".env.local")) return;
  const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  throw new Error("Missing Supabase admin environment variables.");
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: businesses, error: businessError } = await db
  .from("businesses")
  .select("id, created_by")
  .eq("active", true)
  .is("deleted_at", null)
  .limit(1000);

if (businessError) throw businessError;

let created = 0;
let existing = 0;

for (const business of businesses ?? []) {
  const { data: found, error: findError } = await db
    .from("suppliers")
    .select("id")
    .eq("business_id", business.id)
    .eq("supplier_code", "TZ-SUP")
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (found) {
    existing += 1;
    continue;
  }

  const { error } = await db.from("suppliers").insert({
    business_id: business.id,
    supplier_type: "importer",
    legal_name: "TZ Supplier",
    trading_name: "TZ Supplier",
    supplier_code: "TZ-SUP",
    country: "Tanzania",
    default_currency: "KES",
    default_payment_terms: "due_on_receipt",
    active: true,
    on_hold: false,
    approved_supplier: true,
    supplier_category: "Tanzania Supplier",
    status: "approved",
    notes: "Default Tanzania-source supplier for profit-by-source reporting.",
    created_by: business.created_by,
  });

  if (error) throw error;
  created += 1;
}

console.log(`TZ Supplier ensured: created ${created}, existing ${existing}`);
