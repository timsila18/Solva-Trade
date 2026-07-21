import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setActiveBusinessCookie } from "@/lib/tenant";
import { redirectTo, redirectWithError } from "@/lib/auth/route-helpers";

const platformRoles = new Set(["super_administrator", "operations_administrator", "support_agent", "security_reviewer", "read_only_auditor"]);

type SignInPayload = {
  email: string;
  password: string;
  wantsJson: boolean;
};

function jsonResponse(path: string, status = 200) {
  return NextResponse.json({ ok: status < 400, redirectTo: path }, { status });
}

function errorResponse(request: NextRequest, wantsJson: boolean, message: string) {
  if (wantsJson) return NextResponse.json({ ok: false, error: message }, { status: 400 });
  return redirectWithError(request, "/sign-in", message);
}

function successResponse(request: NextRequest, wantsJson: boolean, path: string) {
  if (wantsJson) return jsonResponse(path);
  return redirectTo(request, path);
}

async function readSignInPayload(request: NextRequest): Promise<SignInPayload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      email: typeof body.email === "string" ? body.email.trim() : "",
      password: typeof body.password === "string" ? body.password : "",
      wantsJson: true,
    };
  }

  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  return {
    email: typeof email === "string" ? email.trim() : "",
    password: typeof password === "string" ? password : "",
    wantsJson: false,
  };
}

export async function POST(request: NextRequest) {
  const payload = await readSignInPayload(request);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return errorResponse(request, payload.wantsJson, "Enter a valid email address.");
  }

  if (payload.password.length < 8) {
    return errorResponse(request, payload.wantsJson, "Password must be at least 8 characters.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (error) {
    return errorResponse(request, payload.wantsJson, "We could not sign you in. Check your email and password.");
  }

  const { data: memberships } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("active", true)
    .limit(1);
  const membership = memberships?.[0];
  if (!membership?.business_id) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user && platformRoles.has(String(userData.user.app_metadata?.platform_role ?? ""))) {
      return successResponse(request, payload.wantsJson, "/dashboard");
    }

    const metadataBusinessId = userData.user?.app_metadata?.active_business_id;
    if (typeof metadataBusinessId === "string" && metadataBusinessId.length > 0) {
      await setActiveBusinessCookie(metadataBusinessId);
      return successResponse(request, payload.wantsJson, "/dashboard");
    }

    let platformUser: { id: string } | null = null;
    if (userData.user) {
      try {
        const admin = createSupabaseAdminClient();
        const { data } = await admin
          .from("platform_users")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("active", true)
          .limit(1)
          .maybeSingle();
        platformUser = data;
      } catch {
        const { data } = await supabase
          .from("platform_users")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("active", true)
          .limit(1)
          .maybeSingle();
        platformUser = data;
      }
    }

    if (platformUser?.id) return successResponse(request, payload.wantsJson, "/dashboard");
    return successResponse(request, payload.wantsJson, "/onboarding");
  }

  await setActiveBusinessCookie(membership.business_id);
  const { data: business } = await supabase
    .from("businesses")
    .select("onboarding_status")
    .eq("id", membership.business_id)
    .maybeSingle();
  if (business && business.onboarding_status !== "complete") return successResponse(request, payload.wantsJson, "/onboarding");

  return successResponse(request, payload.wantsJson, "/dashboard");
}
