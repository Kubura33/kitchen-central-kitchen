# Central Kitchen — kuhinjski panel

Single-page kitchen dashboard for `kitchen.centralkitchen.rs`, also shipped
as a Windows desktop app (Tauri). Shows active orders (newest first) with
their pickup codes, lets kitchen staff mark an order as done (which pushes a
notification to the customer's phone), and plays a chime when a new order
arrives.

- **Stack:** Vue 3 + TypeScript + Vite. No router, no store — one page.
  The same bundle runs in the browser and inside the Tauri webview.
- **Transport:** polling every 10 s (the API runs on shared hosting, so no
  websockets). Polling pauses while the tab is hidden and refetches on focus.
- **Auth:** dedicated kitchen account (`role = kitchen`) with a limited API
  token — it can list orders, mark ready, and mark picked up, nothing else.

## Development

```shell
npm install
npm run dev        # expects the Laravel API on http://localhost:8000
npm run test       # vitest
npm run build      # type-check + production build into dist/
```

The API base URL comes from `VITE_API_BASE_URL` (`.env.development` for local
work, `.env.production` is baked into production builds).

## Deployment (shared hosting)

1. `npm run build`
2. Upload the **contents** of `dist/` to the `kitchen.centralkitchen.rs`
   docroot.
3. No `.htaccess` or SPA fallback is needed — the app does not use history
   routing.
4. Log in with the kitchen account (seeded on the API — see the API repo's
   `DEPLOYMENT.md`), and click "Uključi zvuk" once per browser so the
   new-order chime is allowed to play.

The kitchen origin must be allowed in the API's `CORS_ALLOWED_ORIGINS`
(already defaults to `https://kitchen.centralkitchen.rs`).

## Desktop app (Tauri, Windows)

The `src-tauri/` shell wraps the same Vue bundle into a kitchen-appliance
style app:

- **Log in once** — kitchen tokens never expire (API issues them with
  `expires_at = null` for `role = kitchen`), so after the first login the app
  stays signed in until the token is revoked server-side.
- **Sound on by default** — the webview runs with
  `--autoplay-policy=no-user-gesture-required`, so the chime plays from boot
  without the browser's "Uključi zvuk" opt-in ritual (the toggle still works
  for muting).
- **Autostart** — the app registers itself to launch on Windows login, and a
  second launch just focuses the running window (single instance).
- **Self-updating** — on every start it checks
  `github.com/Kubura33/kitchen-central-kitchen/releases/latest/download/latest.json`,
  silently installs any newer release and relaunches. Offline or missing
  feed = it just starts normally.

The desktop webview's origin (`http://tauri.localhost`) is already in the
API's default `CORS_ALLOWED_ORIGINS`.

### Local desktop development

Requires the [Rust toolchain](https://rustup.rs) plus Tauri's Linux
dependencies (`libwebkit2gtk-4.1-dev` etc. — see the Tauri v2 prerequisites
docs). Then:

```shell
npm run tauri dev      # dev app against the vite dev server
npm run tauri build    # local installer build (unsigned updater artifacts)
```

### Releasing a new version

Releases are built by GitHub Actions (`.github/workflows/release.yml`) on a
Windows runner — no local Rust needed.

One-time setup:

1. Push this repo to `github.com/Kubura33/kitchen-central-kitchen`.
   **The repo must be public** so the kitchen PC can download
   `latest.json` and the installer without authentication. If you want the
   code private instead, host those two release files on the
   `kitchen.centralkitchen.rs` subdomain and change
   `plugins.updater.endpoints` in `src-tauri/tauri.conf.json`.
2. Add two repository secrets (Settings → Secrets and variables → Actions):
   - `TAURI_SIGNING_PRIVATE_KEY` — the contents of
     `~/.tauri/kitchen-central-kitchen.key` (updater signing key; **never
     commit it** — losing it means installed apps can't update anymore).
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — empty string (the key has no
     password).

Per release:

1. Bump `version` in `src-tauri/tauri.conf.json` (and `package.json`).
2. Commit, then tag and push: `git tag v0.2.0 && git push origin master v0.2.0`.
3. CI runs the tests, builds the NSIS installer, signs the updater artifact
   and publishes the GitHub release. Installed apps pick it up on their next
   launch.

The installer is not Authenticode-signed (that needs a paid certificate), so
Windows SmartScreen shows a warning **once, at install time** — click
"More info → Run anyway". Updates delivered through the built-in updater do
not re-trigger it.

## How pickups appear here

Pickup codes are typed in the mobile admin app (a customer kiosk may come
later). When an order is picked up it leaves the active list on the next
poll and shows under "Nedavno preuzeto" for five minutes.
