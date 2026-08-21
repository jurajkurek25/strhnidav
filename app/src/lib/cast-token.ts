import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 6 * 60 * 60; // 6h — long enough for one cast session, short-lived if leaked

// Chromecast's receiver fetches the manifest and decryption key directly
// off the network — it never sees the viewer's session cookie. This token
// is the substitute credential for exactly that one path: minted
// cookie-authenticated (src/app/api/cast/[lessonId]/route.ts, after the
// normal login + lesson-gating check), then carried in the manifest/key
// URLs the receiver fetches on its own.
//
// Derived from AUTH_SECRET via HMAC rather than using it directly, so this
// token scheme doesn't share key material with NextAuth's own JWT signing.
function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update("strhnidav-cast-token-v1").digest();
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

export function signCastToken(lessonId: string, userId: string): string {
  const payload = JSON.stringify({ l: lessonId, u: userId, e: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS });
  const payloadB64 = base64url(Buffer.from(payload, "utf8"));
  const signature = createHmac("sha256", deriveKey()).update(payloadB64).digest();
  return `${payloadB64}.${base64url(signature)}`;
}

export function verifyCastToken(token: string, lessonId: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signatureB64] = parts;

  let expectedSig: Buffer;
  let actualSig: Buffer;
  try {
    expectedSig = createHmac("sha256", deriveKey()).update(payloadB64).digest();
    actualSig = Buffer.from(signatureB64, "base64url");
  } catch {
    return false;
  }
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      l: string;
      u: string;
      e: number;
    };
    return payload.l === lessonId && payload.e > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
