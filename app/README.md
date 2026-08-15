# Strhni Dav — členská sekcia

Next.js aplikácia pre členskú sekciu kurzu Strhni Dav. Google prihlásenie,
denne odomykané lekcie (video + AI-vyhodnocovaná úloha), platba 199 € cez
Stripe na odomknutie celého kurzu po prvých 7 bezplatných lekciách, a
plnohodnotný admin panel pre `jurajkurek2006@gmail.com`.

## Ako funguje odomykanie

- Deň 1 je odomknutý hneď po prihlásení.
- Ďalší deň sa odomkne, až keď je predchádzajúci **dopozeraný** (95 %+, bez
  preskakovania dopredu) **a** jeho úloha je **schválená** (AI, alebo
  self-check pri úlohách bez AI) — a odvtedy uplynie kalendárny deň. Čakanie
  viac dní naraz nič nezrýchli, pretože každá ďalšia lekcia stále čaká na
  dokončenie tej pred sebou (`src/lib/gating.ts`).
- Dni 1–7 sú (podľa nastavenia v adminovi) zadarmo. Od 8. dňa je lekcia
  časovo odomknutá, ale zobrazí sa ako "zamknutá kvôli platbe", kým člen
  nezaplatí 199 € cez Stripe.
- Prihlásenie cez `ADMIN_EMAIL` (predvolene `jurajkurek2006@gmail.com`)
  presmeruje rovno do `/admin` namiesto `/dashboard`.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Supabase** — Auth (Google OAuth), Postgres, privátne Storage buckety
- **Stripe** — jednorazová platba 199 €
- **Anthropic Claude API** — vyhodnocovanie textových/obrázkových/PDF úloh

## 1. Supabase projekt

1. Vytvor projekt na [supabase.com](https://supabase.com).
2. V **SQL Editor** spusti postupne obsah `supabase/migrations/0001_init.sql`
   a `supabase/migrations/0002_seed_sections.sql`. Vytvorí to všetky tabuľky,
   RLS politiky a privátne storage buckety (`lesson-videos`,
   `lesson-documents`, `lesson-audio`, `task-uploads`, `lock-art`).
3. **Authentication → Providers → Google**: zapni a vlož Client ID / Secret
   (viď krok 2 nižšie). Ako **Redirect URL** nastav
   `https://<tvoj-supabase-projekt>.supabase.co/auth/v1/callback`.
4. **Settings → API**: skopíruj `Project URL`, `anon public` kľúč a
   `service_role` kľúč do `.env.local`.

## 2. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → vytvor
   OAuth 2.0 Client ID (typ **Web application**).
2. **Authorized redirect URIs**: presne tá istá URL ako v Supabase kroku
   vyššie (`https://<projekt>.supabase.co/auth/v1/callback`).
3. Client ID a Secret vlož do Supabase (Authentication → Providers →
   Google) — nie do `.env` tejto appky, appka ide cez Supabase Auth.

## 3. Stripe

1. Vytvor **Product** "Strhni Dav — celý kurz" s jednorazovou cenou 199 €
   a jeho `price_...` ID daj do `STRIPE_PRICE_ID` (alebo appku nechaj cenu
   vytvoriť dynamicky — funguje aj bez `STRIPE_PRICE_ID`).
2. **Developers → Webhooks** → pridaj endpoint
   `https://<tvoja-domena>/api/stripe/webhook`, event `checkout.session.completed`.
   Skopíruj `whsec_...` do `STRIPE_WEBHOOK_SECRET`.
3. `STRIPE_SECRET_KEY` nájdeš v Developers → API keys.

## 4. Anthropic (AI vyhodnocovanie úloh)

Vytvor API kľúč na [console.anthropic.com](https://console.anthropic.com) a
daj ho do `ANTHROPIC_API_KEY`. Used model: `claude-sonnet-5`.

## 5. Premenné prostredia

```bash
cp .env.example .env.local
# vyplň všetky hodnoty
```

## 6. Lokálny beh

```bash
npm install
npm run dev
```

Otvor `http://localhost:3000`, prihlás sa cez Google — účet
`jurajkurek2006@gmail.com` (nastaviteľné cez `ADMIN_EMAIL`) ťa pošle rovno
do `/admin`, kde pridáš sekcie a lekcie (video, dokumenty, audio, úlohu,
akčné kroky). Ostatní prihlásení používatelia idú do `/dashboard`.

## 7. Nasadenie

Odporúčané: [Vercel](https://vercel.com) — pripoj repozitár, vlož rovnaké
premenné prostredia (aj `NEXT_PUBLIC_SITE_URL` nastav na produkčnú doménu),
a v Google Cloud aj Stripe pridaj produkčné redirect/webhook URL.

## Poznámka k ochrane videa

Video sa streamuje cez krátkodobo platné podpísané URL (10 min) z
privátneho Storage bucketu, tlačidlo na stiahnutie je v prehrávači
vypnuté (`controlsList="nodownload"`) a pravé tlačidlo myši je
zablokované. Toto sú rozumné bežné opatrenia, no žiadne webové video
nie je 100 % nesťahovateľné pre technicky zdatného používateľa (screen
recording vždy funguje) — pre plnú DRM ochranu by bolo treba službu ako
Mux/Vimeo s "signed playback + DRM", čo appka aktuálne nepoužíva.
