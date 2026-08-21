"use server";

import { signIn, signOut } from "@/auth";

// `next` comes from the login page's own ?next= query param (see
// src/proxy.ts, which sets it whenever an unauthenticated visit to a
// protected route — including /buy/[slug] — bounces through /login).
// Only a same-site relative path is ever honored: "//evil.com" is
// protocol-relative (browsers treat it as an absolute URL to another
// host), and anything with "://" is already absolute, so both are
// rejected in favor of the default "/" redirect.
function safeRedirectTarget(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("://")) {
    return next;
  }
  return "/";
}

export async function signInWithGoogleAction(next?: string) {
  await signIn("google", { redirectTo: safeRedirectTarget(next) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
