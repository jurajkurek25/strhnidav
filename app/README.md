# Strhni Dav — členská sekcia

Next.js aplikácia pre členskú sekciu kurzu Strhni Dav. Google prihlásenie,
denne odomykané lekcie (video + AI-vyhodnocovaná úloha), platba 199 € cez
Stripe na odomknutie celého kurzu po prvých 7 bezplatných lekciách, a
plnohodnotný admin panel pre `jurajkurek2006@gmail.com` — vrátane možnosti
udeliť konkrétnemu Gmail účtu celý kurz zadarmo (`/admin/users`).

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

- **Next.js 16** (App Router, TypeScript, Tailwind v4), beží ako Node.js
  server na vlastnom VPS (`next build && next start`) — žiadny Vercel.
- **Supabase** — Auth (Google OAuth), Postgres, Storage buckety
- **Stripe** — jednorazová platba 199 €
- **Anthropic Claude API** — vyhodnocovanie textových/obrázkových/PDF úloh
- **ffmpeg** (`ffmpeg-static`, bundlené v `node_modules`) — balenie videa do
  šifrovaného HLS pri nahratí v admin paneli

## 1. Supabase projekt

1. Vytvor projekt na [supabase.com](https://supabase.com).
2. V **SQL Editor** spusti postupne obsah všetkých súborov v
   `supabase/migrations/` (`0001` → `0006`, v poradí podľa čísla). Vytvorí
   to všetky tabuľky, RLS politiky a storage buckety (`lesson-documents`,
   `lesson-audio`, `task-uploads`, `lock-art` sú privátne;
   `lesson-videos-hls` je verejný — obsahuje len zašifrované segmenty videa,
   viď sekcia o ochrane videa nižšie).
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

## 7. Nasadenie na vlastný VPS

Appka je bežný Node.js server (`next start`), takže ide na akýkoľvek VPS
(Ubuntu/Debian) — žiadny Vercel.

1. **Predpoklady na serveri**: Node.js 20+, a reverse proxy (Nginx) s HTTPS
   (Let's Encrypt / certbot) — HTTPS je nutný, Google OAuth aj bezpečné
   cookies to vyžadujú. `ffmpeg` netreba inštalovať systémovo — appka si ho
   ťahá cez `ffmpeg-static` balíček (funguje na bežných x86_64/arm64
   linuxových VPS; ak by tvoj konkrétny VPS nemal podporovaný binárny
   balíček, treba doinštalovať systémový `ffmpeg` a upraviť
   `src/lib/hls.ts`, aby ho použil namiesto `ffmpeg-static`).
2. **Nasadenie kódu**:
   ```bash
   git clone <repo> && cd app
   npm install
   cp .env.example .env.local   # vyplň produkčné hodnoty, NEXT_PUBLIC_SITE_URL = https://tvoja-domena
   npm run build
   ```
3. **Beh appky** — cez `systemd` alebo `pm2` (odporúčam `pm2` pre
   jednoduchosť a automatický reštart):
   ```bash
   npm install -g pm2
   pm2 start "npm run start" --name strhnidav
   pm2 save && pm2 startup
   ```
4. **Nginx reverse proxy** (príklad, port appky je 3000):
   ```nginx
   server {
       listen 443 ssl;
       server_name tvoja-domena.sk;
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   a `certbot --nginx -d tvoja-domena.sk` na HTTPS certifikát.
5. V Google Cloud aj Stripe nastav redirect/webhook URL na túto doménu
   (rovnaký princíp ako v krokoch 2–3 vyššie, len s produkčnou doménou
   namiesto `localhost`).
6. Spracovanie videa (ffmpeg) beží priamo v tomto Node procese pri nahratí
   v admin paneli — keďže nejde o serverless funkciu s časovým limitom
   (ako by to bolo na Verceli), dlhé videá nie sú problém, len si to
   poriadne "sadne" na CPU na pár sekúnd/minút podľa dĺžky videa.

## Ochrana videa — vlastné šifrovanie (nie klasické DRM)

Video sa pri nahratí v admin paneli rozseká a zašifruje (AES-128, HLS
formát) priamo na tomto serveri cez `ffmpeg` — žiadna externá služba,
žiadne mesačné poplatky (`src/lib/hls.ts`). Zašifrované segmenty (`.ts`)
aj playlist (`.m3u8`) sú verejne dostupné (sú bez kľúča nepoužiteľné),
ale samotný **dešifrovací kľúč** appka vydá len prihlásenému používateľovi,
ktorý má danú lekciu skutočne odomknutú — cez `/api/video-key/[lessonId]`
(`src/app/api/video-key/[lessonId]/route.ts`), s rovnakou kontrolou
prístupu ako všade inde v appke. Kľúč je v databáze v tabuľke
`lesson_video_keys`, ktorá nemá žiadnu RLS politiku pre bežných
používateľov — prečítať ju vie len server (service role kľúč).

Pri tom istom spracovaní appka cez ffmpeg vytiahne aj náhľadový obrázok
(snímka z videa ~1s), ktorý sa ukazuje na dashboarde aj v admin prehľade
lekcií namiesto prázdneho placeholderu.

Toto **nie je** to isté ako Widevine/FairPlay/PlayReady (tie sa nedajú
postaviť bez certifikácie od Google/Apple/Microsoftu cez ich partnerov).
Je to bežné a overené šifrovanie na strane servera + prehrávača
(rovnaký princíp donedávna používal aj samotný priemysel pred nástupom
plného DRM). Zastaví to bežné "klikni pravým tlačidlom a stiahni" aj
priame sťahovanie súboru cez odkaz. Nezastaví to niekoho, kto sa cielene
rozhodne video nahrať cez screen recording — to sa nedá zabrániť žiadnym
spôsobom, ani skutočným DRM (tzv. "analog hole").
