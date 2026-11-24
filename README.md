# IS — deploy-ready Next.js port

A standard Next.js (App Router) port of the **IS shortcuts site** — the
Muse fullstack artifact `khtsrt-lkht` (**v91 "NEBULA" + traced Concept 04
arch logo**, 88 replies in 11 folders, 2 accounts) — prepared for free
hosting on **Vercel (Hobby) + Neon (Free Postgres)**.

No deployment has been done from here. No accounts exist yet. This
folder is the one-time code preparation; deploying is a separate step
below.

## What was converted

| Original (Muse artifact) | This project |
|---|---|
| React client (`client/src/App.tsx`, 12k lines) | `components/App.tsx` — copied as-is, only the SDK imports swapped for local shims |
| `Preview.tsx` (`#/preview`) | `components/Preview.tsx` — as-is (hash routing unchanged) |
| `theme.css` / `tokens.css` | `app/theme.css` / `app/tokens.css` — as-is (Tailwind v4 + Google Fonts) |
| Logo assets | `components/assets/` (bundled) + `public/icons/` (PWA) |
| Server actions (`server/src/actions.ts`, 50 actions) | `lib/actions.ts` — same handlers, same zod schemas, same Arabic errors; only the SDK import changed |
| SQLite schema + 22 migrations | `lib/schema.ts` (drizzle pg-core) + `drizzle/0001_init.sql` (final-state DDL) |
| `ctx.db` (SQLite) | `lib/db.ts` — `pg` Pool over `DATABASE_URL` (Neon) |
| `ctx.blobs` (avatar store) | `avatar_blobs` table in Postgres; served by `app/api/avatar/[userId]/route.ts` |
| `ctx.invalidateQueries()` (SDK bridge) | flag on the ctx; `/api/actions` returns `invalidated: true` and the client refetches |
| `createActionClient` → `./actions` | `components/api.ts` → `POST /api/actions` with the same `{action, args}` envelope and `{data, invalidated}` replies |
| `spaceQueryClient` | `components/query-client.tsx` — same retry policy, staleTime, failure notice |
| `actionFields` Bun macro | `scripts/gen-fields.ts` → `components/fields.generated.ts` (re-run after any request-schema change) |
| `SafeAreaTopScrim` | `components/safe-area.tsx` — same geometry |
| PWA meta tags only | Real PWA: `public/manifest.webmanifest`, `public/sw.js` (registered in `app/page.tsx`), 192/512 + maskable icons |

Password hashing is **unchanged and portable**: `salt$sha256(salt:password)`
via WebCrypto, with the Arabic-Indic digit-shape variants — the exact
functions from the original. Existing password hashes keep working
with the same passwords, as long as the hash values themselves are
transferred (see below).

Auth is token-based (token in `localStorage`, passed as an action
argument), sessions last 1 year with sliding renewal — all unchanged.

## What the site's JSON backup does and does NOT carry

This is the most important fact for the data move. The backup the
live site downloads (`is-shortcuts-backup.json`) is:

```json
{ "shortcuts": [{ "title", "body", "category", "tags", "extShortcut", "source" }] }
```

**It carries only the replies.** It does NOT carry:

- accounts or password hashes (they never leave the server),
- folder nesting, pins, descriptions, icons, folder sources,
- shortcut usage counts, favorites, pins, trash state,
- smart folders, copy history, sessions, avatars.

What DOES come back automatically: folder **names** — the ported
`ensureFolders()` recreates top-level folders from the replies'
categories on first load, exactly like the original.

### The realistic data move (JSON backup path)

1. Deploy (below), then **register the owner's account on the new
   site with the same email + password** (a fresh hash is created;
   the password is the same, so sign-in works the same).
2. Download `is-shortcuts-backup.json` from the live site.
3. `DATABASE_URL=... node scripts/import-backup.ts --backup is-shortcuts-backup.json --user <owner email>`
4. Open the new site and sign in — folders rebuild from categories
   on first load.
5. Re-upload the profile picture (avatars don't transfer in the
   backup). Folder pins/descriptions/icons/sources and smart folders
   need re-doing by hand.

### Full-fidelity move (full export available since v71)

`scripts/import-backup.ts --full full-export.json` accepts
`{ users, folders, shortcuts, copyHistory, sessions, smartFolders,
siteConfig, avatars: [{ userId, mimeType, dataBase64 }] }` with the
original ids and password hashes as-is, and resets the id sequences
afterwards. Sessions transfer too, so existing device tokens keep
working. The file comes from the live site itself: the owner-only
«تصدير نسخة كاملة» button (the `exportFullBackup` action) downloads
`is-full-backup.json` with every table, including folder icon colours.
The round trip is proven end-to-end by `scripts/verify-full-backup.mjs`
(150/150 checks, pg-mem): export through the ported action → import
with the real importer → field-level match on every row, login works
afterwards, second import inserts nothing.

## Deploy (after the accounts exist)

1. **GitHub** — create a repo, push this folder.
2. **Neon** — create a project + Postgres database; copy the
   connection string (it must include `?sslmode=require`).
3. **Set up the schema** (once, from this machine):
   `DATABASE_URL=<neon string> node scripts/setup-db.ts`
4. **Vercel** — import the GitHub repo (framework: Next.js).
   Set the environment variable `DATABASE_URL` to the Neon string
   (Project → Settings → Environment Variables). No other env vars.
5. Deploy. Open the site, register, import the backup (above).
6. Optional: submit the public URL to Google Search Console —
   the SEO/Open Graph/schema tags are already in `app/layout.tsx`.
   Google indexes the public login page only; the 88 replies stay
   behind sign-in.

## Local development

```sh
npm install
cp .env.example .env.local   # set DATABASE_URL (Neon, or a local Postgres)
npm run dev                  # http://localhost:3000
npm run build && npm start   # production build
npm run typecheck            # tsc --noEmit
npm run gen:fields           # regenerate components/fields.generated.ts
```

Without `DATABASE_URL` the pages still render (login page), but every
action answers with a clear `DATABASE_URL is not set` error.

## Verification done in this preparation

- `npm run build` passes (Next.js production build) — re-run after
  the v91 UI re-sync below, clean.
- `npm run typecheck` passes clean.
- `npm run gen:fields` regenerates the 50-action FIELDS map.
- Login page over HTTP (`next start -p 3100` + curl): `GET /` → 200
  with the correct title, manifest → 200, all 7 page JS chunks →
  200, and the login strings («تسجيل الدخول», «كلمة المرور») are
  present in the built client bundle. The login form itself is
  client-rendered (the page is `ssr: false` because App.tsx reads
  `window.location.hash` unguarded), so a real-browser render was
  NOT proven here — see the honest list.
- Server actions exercised end-to-end against `pg-mem` (an
  in-memory Postgres emulator): **28/28 checks pass** in
  `scripts/verify-actions.mjs` (test-only, not part of the deploy):
  register → login (same salt$sha256 hash format, incl.
  Arabic-Indic digit variants) → wrong-password rejection →
  auto-seed of the first account (86 replies) → folders rebuilt
  from categories (11) → create/update/favorite/copy-history →
  create/move folder → folder icon colours (named key, custom hex
  lowercased, invalid → null; rename + smart folder) → trash/restore
  → avatar set/me/remove → import dedupe (1 imported, 1 skipped) →
  owner-only usage reset (clears history, zeroes usage) → logout
  invalidates the token. The script documents the pg-mem quirks it
  works around (pg-proxy driver, array rows, parameterized-query
  path) — all emulator-only; real Postgres needs none of it.
- Full-backup export → import round trip: **150/150 checks pass**
  in `scripts/verify-full-backup.mjs` (test-only): the ported
  `exportFullBackup` action exports a seeded DB (2 users, 16 folders,
  90 shortcuts, copy history, smart folders, avatar), the real
  `scripts/import-backup.ts --full` imports it into a second pg-mem
  DB, every row matches field-for-field (incl. folder `iconColor`
  "royal" and smart-folder `iconColor` "#12ab34"), login works after
  import, second import inserts nothing.
- API error shapes match the original: unknown action → 404,
  invalid args → 422 with the zod issues JSON, missing
  DATABASE_URL → 400 with a clear message (not an empty 500).

## UI re-sync (v91 NEBULA + traced arch logo)

- 2026-11-24 ~16:55 EET: `components/App.tsx` (13,062 lines),
  `components/Preview.tsx`, `app/theme.css` (37 lines) and
  `app/tokens.css` (4,854 lines) were re-copied from the live
  artifact's **v91** state — NEBULA identity, the v91 design layer
  (folder icon tiles, glass search well, gradient filter edge,
  selected-card spine), and the Concept 04 arch logo traced
  pixel-by-pixel from the board (inline SVG, viewBox 240×227;
  the old intertwined-mark PNGs are gone) — with the same port
  transformations re-applied (SDK imports → local shims, FIELDS
  macro → generated map, `.get()` → array indexing,
  `db.run` → parameterized `db.execute`). `lib/actions.ts` (50
  actions, incl. the owner-only `resetUsageStats`) and
  `lib/schema.ts` (migrations 0001–0022, incl. `icon_color` on
  folders + smart folders) were re-ported the same way;
  `drizzle/0001_init.sql` and `scripts/import-backup.ts --full`
  gained the `icon_color` columns; the PWA icons were regenerated
  from the new arch favicon (maskable keeps the old ~66% content
  ratio); `app/layout.tsx` took the v91 theme colours
  (#EDF3FE / #050A18) and the JSON-LD block; the service-worker
  cache bumped to `is-cache-v2`. Typecheck + build + all checks
  above were re-run after the sync: **28/28 action checks,
  150/150 full-backup checks, build clean, HTTP 200s, and the
  v91 markers (`.card-tile`, arch viewBox, `--logo-deep`,
  `is-accent-nebula89` heal flag) confirmed present in the
  production bundle.**
- **Caveat:** before deploying, compare the artifact's
  `client/src/App.tsx` / `tokens.css` mtimes against this
  project's copies and re-sync if they moved — the live site
  keeps evolving (the previous sync was v71, 2026-11-20).

## UI re-sync (v71 luxury redesign) — superseded by v91 above

- 2026-11-20 ~16:45 EET: `components/App.tsx` (12,230 lines) and
  `app/tokens.css` (2,919 lines) were re-copied from the live
  artifact's v71 «Islamic Luxury» state (KhatamStar motif, real
  brand icons, refined hero) with the same three port
  transformations re-applied (SDK imports → local shims, FIELDS
  macro line removed, logo `.src`); `Preview.tsx`, `theme.css`
  and `server/src/actions.ts` were unchanged on the artifact, so
  no re-port was needed. Typecheck + build + all checks above
  were re-run after the sync.
- **Caveat:** the v71 builder on the live artifact was still
  running when this sync was taken (its source files last changed
  16:38 EET and were unchanged at sync time). Before deploying,
  compare the artifact's `client/src/App.tsx` / `tokens.css`
  mtimes against this project's copies and re-sync if they moved.

## Not verified / risks (honest list)

- **No real Neon database was available during preparation**, so the
  Postgres SQL was verified against `pg-mem`, not a live Neon
  instance. Run `db:setup` + the import against the real Neon DB
  before announcing the move; the DDL is standard Postgres.
- **Real-browser login render not proven.** The bundled Chromium
  in this VM refuses to start without the runtime's WebGL domain
  policy, and `scripts/verify-render.mjs` (jsdom) cannot run
  Next.js 16 Turbopack bundles — Turbopack's loader throws
  `Expected document.currentScript to be a <script> element`
  inside jsdom, which is a jsdom/Turbopack incompatibility, not an
  app bug. What IS proven: the page serves 200, every JS chunk
  loads 200, the login strings are in the built bundle, and the
  client code is byte-identical to the artifact's apart from the
  import shims. Open the deployed site in a real browser once and
  confirm the login form paints before telling the user it works.
- **The v91 design may still move.** See "UI re-sync (v91 …)"
  above: re-check the artifact's file mtimes before deploying.
- Physical drag & drop feel, LTR/Safari/Firefox rendering and
  Lighthouse numbers were already unverified on the original and
  remain so here — the UI code is byte-identical apart from the
  import shims, so any difference would come from the Next.js
  runtime, not the design.
- The service worker caches only the app shell and static assets;
  API traffic is never cached. First visit still needs the network.
- Neon Free sleeps after ~5 minutes idle: the first login after a
  pause may take a few seconds (same caveat as the original plan).
- `restoreOwnerAccess` (the one-time password restore) is ported
  verbatim, including its key-hash check and one-time
  `site_config` marker. If the marker transfers in a full export,
  it stays used; on a fresh database it is armed once.
