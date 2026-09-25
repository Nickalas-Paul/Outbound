# Parity checklist — Phase 4 Step 1

Web verified by Cursor. Android verified by Nico on Pixel (EAS development build).

**Android build:** `a5a38ea4-7e5e-447c-bf1f-e7cd81d838a6` (profile `development`, APK)

| Item | Web | Android |
|------|-----|---------|
| App launches | PASS | PASS |
| Map renders tiles and country fills | PASS | PASS |
| Tapping a country opens the destination page | PASS | PASS (sheet + page) |
| Preferences panel changes the map | PASS | PASS |
| Destination page — quick facts | PASS | PASS |
| Destination page — dimensions | PASS | PASS |
| Destination page — signals | PASS | PASS |
| Destination page — trends | PASS (chart renders on web) | KNOWN GAP — native trend chart stub (Step 2) |
| Compare view | PASS | PASS |
| About page | PASS | PASS |
| Navigation (web sidebar / native tabs) | PASS (sidebar) | PASS (bottom tabs) |
| Welcome overlay shows and dismisses | PASS | KNOWN GAP — persistence uses `localStorage` only; dismiss may not stick on native (Step 2) |
| Intake steps 1–4 navigate | PASS | PASS with dates typed `YYYY-MM-DD`; KNOWN GAP — free-text dates still block unless ISO (Step 3) |
| Login screen renders | PASS | PASS; KNOWN GAP — Turnstile stub / native captcha (Step 2); Google OAuth callback is web-oriented (Step 2) |
| API errors surface gracefully | PASS | — (not re-checked on device) |

## Web verification notes

- Playwright smoke: `apps/universal/scripts/integration-pass.cjs` (screenshots under `apps/universal/.integration-shots/`, gitignored).
- Manual / script coverage: welcome, explorer map, destination detail sections, compare, About, Plan/intake navigation, login, responsive breakpoints.
- Known product gaps above are **not** fixed in Step 1; tracked for Steps 2–3 only.

## Android verification notes (Nico, Pixel)

- Map, preferences, destination sections, compare, About, bottom tabs, and login confirmed working.
- Intake submitted end to end (all 4 steps, dates as `YYYY-MM-DD`); trip saved; verification email delivered.
- Verify link in email points to `localhost` and a nonexistent `/verify` route — **KNOWN GAP (Step 2)**.
