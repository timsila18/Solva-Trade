import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";
import { searchWorkspace } from "@/lib/global-search";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to search your records." }, { status: 401, headers });
  const businessId = await getActiveBusinessId() || user.app_metadata.active_business_id;
  if (typeof businessId !== "string" || !businessId) return NextResponse.json({ results: [], partial: false }, { headers });
  try {
    return NextResponse.json(await searchWorkspace(client, businessId, new URL(request.url).searchParams.get("q") || ""), { headers });
  } catch {
    return NextResponse.json({ error: "Search is unavailable. Please try again." }, { status: 503, headers });
  }
}
