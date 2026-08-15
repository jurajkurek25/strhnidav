import type { NextAuthConfig } from "next-auth";

// Edge-safe half of the NextAuth config — used directly by src/proxy.ts
// (which runs on the Edge runtime and can't open a raw Postgres/`pg`
// connection). No providers or DB callbacks here; those live in src/auth.ts
// and only run in the Node.js runtime (route handlers, Server Components,
// Server Actions). JWT session strategy means the middleware can read
// token.id straight out of the signed cookie — no DB call needed to route
// an already-authenticated request.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  // Required behind a reverse proxy (CloudPanel/Nginx) — otherwise NextAuth
  // derives its own origin from the incoming request and can end up
  // redirecting to whatever internal address the proxy forwards from
  // (the same class of bug this app already hit twice with Supabase's
  // window.location.origin / request.url).
  trustHost: true,
  providers: [],
  callbacks: {
    // Only reads token.id here — it's *set* in the jwt callback in
    // src/auth.ts (the Node-only half, which upserts into `profiles` via
    // Drizzle on first sign-in). This half just needs to expose it, since
    // it also runs inside src/proxy.ts on the Edge runtime.
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
