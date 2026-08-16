import { NextResponse } from "next/server";
import { runDailyDigest } from "@/lib/notifications";

// Not guarded by src/proxy.ts (only /dashboard, /lesson, /admin are) — auth
// happens here instead, the same pattern as the Stripe webhook route.
// Triggered by an OS-level cron job on the VPS (no in-process job queue),
// see README: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" ...`.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runDailyDigest();
  return NextResponse.json(result);
}
