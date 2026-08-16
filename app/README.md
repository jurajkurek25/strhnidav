# Strhni Dav — členská sekcia

Next.js aplikácia pre členskú sekciu kurzu Strhni Dav. Google prihlásenie,
denne odomykané lekcie (video + AI-vyhodnocovaná úloha), platba 199 € cez
Stripe na odomknutie celého kurzu po prvých 7 bezplatných lekciách, a
plnohodnotný admin panel pre `jurajkurek2006@gmail.com` — vrátane možnosti
udeliť konkrétnemu Gmail účtu celý kurz zadarmo (`/admin/users`) a
drag-and-drop preusporiadania (poradie dní, sekcií, akčných krokov aj
dokumentov/audia v rámci lekcie).

**Plne self-hosted, žiadne SaaS okrem platobnej brány a AI:** vlastný
Postgres, vlastné Google prihlásenie (NextAuth/Auth.js — beží priamo v tejto
appke, nie cez tretiu stranu) a súbory na lokálnom disku servera. Jediné dve
externé služby, ktoré appka reálne používa, sú Stripe (platobná brána) a
Anthropic (AI vyhodnocovanie úloh) — obe svojou povahou nejdú nahradiť
niečím "vlastným" na malom VPS.

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
- **Postgres** priamo cez [Drizzle ORM](https://orm.drizzle.team/) (`pg`
  driver) — žiadne PostgREST, žiadne RLS; prístupové práva sa kontrolujú v
  appke (`src/lib/auth.ts`, `src/lib/course.ts`), presne tam, kde by to aj
  s RLS musela appka overiť ešte raz.
- **NextAuth / Auth.js v5** — Google OAuth prihlásenie, JWT session (podpísaný
  cookie, žiadna session tabuľka v DB). Beží úplne vo vnútri tejto appky,
  žiadna externá auth služba.
- **Lokálne súborové úložisko** (`STORAGE_ROOT` na disku VPS) namiesto
  cloud storage bucketov — `src/lib/storage.ts`.
- **Stripe** — jednorazová platba 199 €.
- **Anthropic Claude API** — vyhodnocovanie textových/obrázkových/PDF úloh.
- **ffmpeg** (`ffmpeg-static`, bundlené v `node_modules`) — balenie videa do
  šifrovaného HLS pri nahratí v admin paneli.

## 1. Postgres

Appka potrebuje bežiaci Postgres (14+) — buď priamo na VPS, alebo kdekoľvek
inde, kam appka dovidí.

```bash
# napr. na Ubuntu/Debian
sudo apt-get install -y postgresql
sudo -u postgres createuser strhnidav --pwprompt
sudo -u postgres createdb strhnidav -O strhnidav
```

`DATABASE_URL` v `.env` potom bude
`postgresql://strhnidav:<heslo>@localhost:5432/strhnidav`.

Spusti migráciu (vytvorí všetky tabuľky, žiadne RLS, žiadne storage
buckety):

```bash
psql "$DATABASE_URL" -f migrations/0001_init.sql
```

Ak v budúcnosti pribudne ďalšia migrácia (`migrations/0002_*.sql`...), spusti
ju rovnako — v poradí podľa čísla.

## 2. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs &
   Services → Credentials** → vytvor OAuth 2.0 Client ID (typ **Web
   application**).
2. **Authorized redirect URIs**: presne
   `{NEXT_PUBLIC_SITE_URL}/api/auth/callback/google` (napr.
   `https://kurz.strhnidav.sk/api/auth/callback/google` v produkcii,
   `http://localhost:3000/api/auth/callback/google` lokálne).
3. Client ID a Secret daj do `.env` ako `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`.
4. Vygeneruj `AUTH_SECRET` (podpisuje/šifruje session cookie):
   ```bash
   openssl rand -base64 33
   ```
5. Nastav `AUTH_URL` na presne tú istú hodnotu ako `NEXT_PUBLIC_SITE_URL`
   (napr. `https://kurz.strhnidav.sk`). **Za reverzným proxy (CloudPanel/
   Nginx) je to povinné** — bez toho si NextAuth vie odvodiť redirect URI
   z toho, ako appka vidí prichádzajúcu požiadavku (napr.
   `http://localhost:7777`), čo Google odmietne s `redirect_uri_mismatch`,
   keďže v Google Console je zaregistrovaná len verejná URL.

Prihlasovanie ide teraz priamo appka → Google, bez medzikroku cez tretiu
stranu.

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
cp .env.example .env
# vyplň všetky hodnoty — pozor, .env má prednosť pred .env.local nemá zmysel
# tu udržiavať oba naraz (Next.js .env.local by prepísal .env)
```

`STORAGE_ROOT` musí byť priečinok, do ktorého appka vie zapisovať (napr.
`/home/strhnidav-kurz/storage`, mimo `htdocs`, aby nebol priamo prístupný cez
web server) — vytvor ho vopred:

```bash
mkdir -p /home/strhnidav-kurz/storage
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

## 7. Nasadenie na CloudPanel VPS

Appka je bežný Node.js server (`next start`), beží na porte **7777**
(nastavené v `package.json`'s `start` skripte) — v CloudPanel si pri danej
stránke (Node.js site) nastav **App Port = 7777**, CloudPanel sa postará o
Nginx reverse proxy aj Let's Encrypt SSL automaticky.

1. **Predpoklady na serveri**: Node.js 20+ (CloudPanel to ponúka pri tvorbe
   Node.js stránky), Postgres (viď krok 1 vyššie). `ffmpeg` netreba
   inštalovať systémovo — appka si ho ťahá cez `ffmpeg-static` balíček
   (funguje na bežných x86_64/arm64 linuxových VPS; ak by tvoj konkrétny VPS
   nemal podporovaný binárny balíček, treba doinštalovať systémový `ffmpeg`
   a upraviť `src/lib/hls.ts`, aby ho použil namiesto `ffmpeg-static`).

2. **Nahratie kódu** — repozitár má appku v podpriečinku `app/` (vedľa
   `landing.html`), takže sa nedá `git clone` priamo do cieľového
   priečinka. Skontroluj si najprv, či `/home/strhnidav-kurz/htdocs/kurz.strhnidav.sk`
   je prázdny (`ls -la`) — ak tam CloudPanel nechal nejaké súbory (napr.
   default `index.html`), radšej si ich zálohuj, než ich prepíšeš.

   **Trvalý klon nabok + update skript** (nech `git pull` funguje pri
   ďalších aktualizáciách — priamy klon do `htdocs/...` by nebol skutočný
   git repozitár, keďže appka je v podpriečinku `app/`):

   ```bash
   git clone --branch claude/membership-course-app-4orr1v \
     https://github.com/jurajkurek25/strhnidav.git /home/strhnidav-kurz/repo
   ```

   Ulož ako `/home/strhnidav-kurz/update-strhnidav.sh`:

   ```bash
   #!/bin/bash
   set -e
   cd /home/strhnidav-kurz/repo
   git pull origin claude/membership-course-app-4orr1v
   echo "Deploying commit: $(git log -1 --oneline)"
   rsync -a --delete --exclude='.env' --exclude='.env.local' \
     --exclude='node_modules' --exclude='.next' \
     app/ /home/strhnidav-kurz/htdocs/kurz.strhnidav.sk/
   cd /home/strhnidav-kurz/htdocs/kurz.strhnidav.sk
   npm install
   rm -rf .next
   npm run build
   pm2 restart strhnidav
   ```

   `rm -rf .next` pred buildom odstraňuje akékoľvek riziko, že Turbopack
   znova použije zastaranú build cache namiesto prekompilovania zmenených
   súborov (Tailwind triedy sa generujú práve pri builde). `--delete` na
   rsync je rovnako dôležité — bez neho súbory, ktoré v novej verzii kódu
   už neexistujú (napr. celý starý priečinok po väčšom refaktore), v
   `htdocs/...` jednoducho ostanú ležať namiesto zmazania, aj keď sa na ne
   už nikde neodkazuje.

   ```bash
   chmod +x /home/strhnidav-kurz/update-strhnidav.sh
   ```

   Prvé spustenie treba doplniť o `.env` (skopíruj `.env.example`, vyplň) a
   o migráciu (`psql "$DATABASE_URL" -f migrations/0001_init.sql`) — potom
   už pri každej ďalšej aktualizácii stačí
   `/home/strhnidav-kurz/update-strhnidav.sh`.

3. **Beh appky** — cez CloudPanel's vlastnú Node.js správu (Site → Node.js
   → Start Command: `npm run start`) alebo cez `pm2`, ak chceš appku
   spravovať mimo CloudPanelu:
   ```bash
   npm install -g pm2
   pm2 start "npm run start" --name strhnidav
   pm2 save && pm2 startup
   ```
4. V Google Cloud aj Stripe nastav redirect/webhook URL na túto doménu
   (rovnaký princíp ako v krokoch 2–3 vyššie, len s produkčnou doménou
   namiesto `localhost`).
5. Spracovanie videa (ffmpeg) beží priamo v tomto Node procese pri nahratí
   v admin paneli — keďže nejde o serverless funkciu s časovým limitom
   (ako by to bolo na Verceli), dlhé videá nie sú problém, len si to
   poriadne "sadne" na CPU na pár sekúnd/minút podľa dĺžky videa.

## 8. E-mailové notifikácie (SMTP + denný cron)

Appka vie posielať dva typy e-mailov cez vlastný SMTP (žiadna tretia strana
ako Mailgun/Sendgrid):

- **Odomknutie lekcie** — pošle sa presne v deň, keď sa niekomu odomkne
  ďalšia lekcia (Deň 1 sa nepočíta, ten je dostupný hneď po registrácii).
- **Pripomienka** — ak si po 3 dňoch od odomknutia lekciu ešte nezačal/-a,
  pošle sa jedna jemná pripomienka (a už nie viac, kým lekciu nedokončíš).

Obe sú idempotentné — každý e-mail sa danému používateľovi k danej lekcii
pošle najviac raz, aj keby sa cron spustil viackrát (tabuľka
`email_notifications` v `migrations/0004_email_notifications.sql`).

1. Doplň do `.env` SMTP údaje od tvojho poskytovateľa (`SMTP_HOST`,
   `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Pokým `SMTP_HOST`
   necháš prázdne, appka e-maily len loguje a nič neposiela — nič sa
   nepokazí, kým SMTP nezapojíš.
2. Vygeneruj `CRON_SECRET` (`openssl rand -hex 24`) a daj ho do `.env`.
3. Spusti migráciu:
   ```bash
   psql "$DATABASE_URL" -f migrations/0004_email_notifications.sql
   ```
4. Pridaj do crontabu (`crontab -e`) riadok, ktorý raz denne (napr. o 8:00)
   zavolá endpoint — nahraď `CRON_SECRET_HODNOTA` skutočnou hodnotou z `.env`:
   ```
   0 8 * * * curl -s -X POST -H "Authorization: Bearer CRON_SECRET_HODNOTA" https://kurz.strhnidav.sk/api/cron/daily-digest
   ```

## Ochrana videa — vlastné šifrovanie (nie klasické DRM)

Video sa pri nahratí v admin paneli rozseká a zašifruje (AES-128, HLS
formát) priamo na tomto serveri cez `ffmpeg` — žiadna externá služba,
žiadne mesačné poplatky (`src/lib/hls.ts`). Zašifrované segmenty (`.ts`)
aj playlist (`.m3u8`) sa ukladajú ako verejné statické súbory
(`STORAGE_ROOT/public/hls/...`, servírované cez `src/app/media/[...path]`,
bez kontroly prístupu — sú bez kľúča nepoužiteľné), ale samotný
**dešifrovací kľúč** appka vydá len prihlásenému používateľovi, ktorý má
danú lekciu skutočne odomknutú — cez `/api/video-key/[lessonId]`
(`src/app/api/video-key/[lessonId]/route.ts`), s rovnakou kontrolou
prístupu ako všade inde v appke. Kľúč je v databáze v tabuľke
`lesson_video_keys`, ktorú číta iba server (Drizzle, priame pripojenie na
Postgres) — nikdy nejde na klienta.

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

## Súborové úložisko

Všetky nahrané/generované súbory sú na lokálnom disku pod `STORAGE_ROOT`
(`src/lib/storage.ts`), v dvoch priestoroch:

- `public/` — HLS video segmenty/playlist, thumbnaily. Servíruje
  `src/app/media/[...path]/route.ts` bez kontroly prístupu (bezpečné, lebo
  video je bez kľúča nepoužiteľné).
- `private/` — dokumenty, audio, nahraté úlohy. Dokumenty a audio servíruje
  `src/app/api/files/[bucket]/[...path]/route.ts` až po overení, že
  používateľ je prihlásený **a** má danú lekciu odomknutú (rovnaká kontrola
  ako pri videu). Nahraté úlohy (`task-uploads`) sa nikde späť neservírujú,
  ostávajú len ako záznam.

Pri mazaní lekcie/dokumentu/audia appka zároveň zmaže aj príslušné súbory z
disku, nech sa `STORAGE_ROOT` časom nezaplní osirotenými súbormi.
