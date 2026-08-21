import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { profiles, freeAccessGrants } from "@/lib/db/schema";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jurajkurek2006@gmail.com";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Runs once per real sign-in (account/profile are only present then,
    // not on every subsequent session refresh) — this is the direct
    // replacement for the old Postgres `handle_new_user()` trigger that
    // used to fire on `auth.users` INSERT. Upserts the profile row and
    // sets token.id to *our* internal profiles.id (not Google's `sub`),
    // which src/auth.config.ts's session callback then exposes to the app.
    async jwt({ token, account, profile: googleProfile }) {
      if (account && googleProfile?.sub && googleProfile.email) {
        const email = googleProfile.email.toLowerCase();
        const isAdmin = email === ADMIN_EMAIL.toLowerCase();

        const existing = await db.query.profiles.findFirst({
          where: eq(profiles.googleId, googleProfile.sub),
        });

        if (existing) {
          await db
            .update(profiles)
            .set({
              email,
              fullName: (googleProfile.name as string | undefined) ?? existing.fullName,
              avatarUrl: (googleProfile.picture as string | undefined) ?? existing.avatarUrl,
            })
            .where(eq(profiles.id, existing.id));
          token.id = existing.id;
        } else {
          const grant = await db.query.freeAccessGrants.findFirst({
            where: eq(freeAccessGrants.email, email),
          });
          const [created] = await db
            .insert(profiles)
            .values({
              googleId: googleProfile.sub,
              email,
              fullName: (googleProfile.name as string | undefined) ?? null,
              avatarUrl: (googleProfile.picture as string | undefined) ?? null,
              isAdmin,
              hasFullAccess: isAdmin || Boolean(grant),
              purchasedAt: grant ? new Date() : null,
            })
            .returning({ id: profiles.id });
          token.id = created.id;
        }
      }
      return token;
    },
  },
});
