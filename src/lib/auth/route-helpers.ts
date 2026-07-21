import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8);

export function redirectTo(request: NextRequest, path: string, status = 303) {
  return NextResponse.redirect(new URL(path, request.url), status);
}

export function redirectWithError(request: NextRequest, path: string, message: string) {
  const url = new URL(path, request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

export function redirectWithMessage(request: NextRequest, path: string, message: string) {
  const url = new URL(path, request.url);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, 303);
}

export function parseEmail(formData: FormData) {
  return emailSchema.safeParse(formData.get("email"));
}

export function parsePassword(formData: FormData) {
  return passwordSchema.safeParse(formData.get("password"));
}
