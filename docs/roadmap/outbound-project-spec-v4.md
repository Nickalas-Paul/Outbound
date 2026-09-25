# Outbound — Project Specification & Phase Plan (v4)

**Version:** 4 — supersedes v3.1, v3, v2, v1
**Status:** Locked — Phase 4 active (Step 0 complete)
**Repository:** github.com/Nickalas-Paul/Outbound (main `5f07905` at Phase 3 seal; develop `baec4af`)
**Operator:** Nico (sole operator, architect, product owner)
**Workflow:** Claude architects and drafts Cursor prompts. Cursor executes all code, git, CLI. Nico reviews and decides.

---

## MVP Tracker (the single reference for where we are)

**Goal:** One complete MVP — both service tiers, every pipeline working end to end, real-money ready — running as one app on web and Android. It launches once, complete.

### Phase 4 — Complete the System

Every step is verified on web **and** Android before merge (rule 10).

| # | Step | Status |
|---|---|---|
| 0 | Housekeeping | ✅ Done (`baec4af`) |
| 1 | Native running: EAS dev build on Pixel, parity checklist | ▶ Next |
| 2 | Parity and critical fixes: `/verify` route, Turnstile on native, shared storage, native trend chart, OAuth callback, orphan cleanup | |
| 3 | Unified date field | |
| 4 | Correspondence hardening: webhook security, identity policy, confirmation via link only | |
| 5 | Payments and ledger (test mode): client card collection, payment state machine, payments/refunds ledger | |
| 6 | Duffel booking execution: real traveler data, payment-contingent booking, partial-failure handling, first full end-to-end run | |
| 7 | Viator: tours and experiences in composition and booking, on the same payment-backed pipeline | |
| 8 | Scheduler and lifecycle: automated follow-ups, send log, trip status transitions | |
| 9 | Cancellations and refunds across Duffel and Viator | |
| 10 | Modifications: flight changes; hotel and tour changes escalate with suggested responses | |
| 11 | Admin operations: suggested drafts, approval queues, booking monitor | |
| 12 | Test suite: correspondence, routing, payments, booking and lifecycle state transitions | |

### Phase 5 — Launch Readiness

Google Places verification · composition retry on failed parsing · domain, email authentication, inbound email · app links · content overhaul · legal (Seller of Travel, terms, privacy, AI disclosure, cancellation policy) · Duffel and Viator production access · live payments · production deployment · Play Store release and iOS decision · security review · performance baseline.

### Tracking rule

This step list is fixed for the phase. A new finding goes into the existing step it belongs to. If it fits no step, it goes on the **parked list** below and is reviewed at phase seal. Steps are never added mid-phase.

### Parked list

*(empty)*

---

## Changelog

### v3.1 → v4

- **Full-scope MVP, single launch.** The itinerary-only beta is dropped. Both tiers launch together once the whole system is complete. The old Phase 6 (Full-Service Launch) is folded into Phases 4 and 5.
- **Phase 4 rebuilt as a fixed 13-step list (0–12)**, including payments, Viator, cancellations, and modifications.
- **Payments before booking.** Payment collection and the ledger (Step 5) precede Duffel (Step 6) and Viator (Step 7) execution, so booking is built once, on top of payment, rather than rebuilt later.
- **Android dev environment:** EAS development build installed on Nico's Google Pixel (Android Studio could not be installed). Android verification is performed manually by Nico from a checklist Cursor provides.
- **Tracking rule and parked list** added to prevent mid-phase drift.
- **External dependencies** section added (items that depend on third-party approval).

### Earlier versions (summary)

- **v3.1:** Platform principle (one app, multiple environments); parity gate (rule 10); native parity audit findings.
- **v3:** Positioning and identity policy ("don't advertise, never deny"); Phase 3 recorded as built; booking triggered only by tokenized link (GET page → POST action); Phase 4 re-baselined from the readiness audit.
- **v2:** Two-tier service model; Duffel booking; structured confirmation gate.
- **v1:** Original specification cloned from GEXIS.

---

## North Star

A professional travel intelligence and concierge service. Visitors land on an interactive geospatial explorer, get inspired by real data about destinations worldwide, and move into a planning funnel. Trip requests are researched, composed, and refined with the client, then either delivered as a self-service plan (Itinerary Planning) or executed end to end through automated, payment-backed booking (Full-Service Concierge). A real, accountable person oversees the service and handles situations that need judgment. The same product runs on the web and as a native mobile app.

---

## Platform Principle

**Outbound is one app that runs in multiple environments.** One codebase (Expo universal app), one feature set, one API contract, one validation schema.

| Platform | Status |
|---|---|
| Web (desktop and mobile browsers) | Verified target |
| Android native | Verified target (EAS development build on Pixel) |
| iOS native | Code stays iOS-compatible; build and release decided in Phase 5 |

**Rules:**

1. Platform-specific code lives only behind one shared interface (`.web.tsx` / `.tsx` pairs with identical props).
2. No feature is web-only or native-only. A `return null` stub is a defect, not a feature.
3. No platform-based server bypasses. The server enforces identical rules for every client.
4. Browser-only APIs appear only in `.web.tsx` files or behind shared helpers with a native counterpart.
5. No Android-only native modules without React Native wrappers that also support iOS.
6. Native configuration lives in `app.json` only. The generated `android/` and `ios/` folders are not committed (continuous native generation).

**Legitimate platform differences (not drift):**

| Difference | Reason |
|---|---|
| Map hover (web) vs tap-to-select (native) | Touchscreens have no hover |
| Filter/compare state in URL (web) vs in-app state (native) | Native has no address bar |
| Email links open server-rendered web pages on every device | Universal by design; app links come in Phase 5 |
| Admin dashboard is server-rendered web only | Operator tooling, not part of the client app |

---

## Positioning & Identity Policy

**Brand promise:** Researched travel planning, with a real person accountable for every trip.

**Operator framing:** Nico is named, reachable, and accountable. His experience is described as having lived and worked across four continents, not as a list of countries.

**Automation disclosure — "don't advertise, never deny":**

- Client-facing copy does not describe the tooling (AI, models, automation, pipelines).
- The system never claims or implies to be a human. No prompt may instruct the model that it is a person or that it is Nico.
- Identity questions ("Am I talking to a person/AI?", "Can I speak to Nico?") are classified `identity_query` or `escalation_request` and escalated to Nico with a suggested draft. They are never answered autonomously.

**Voice:** Automated correspondence uses the "Outbound" voice ("we"), signed "— The Outbound Team" with a line offering direct access to Nico. First-person "I" is reserved for messages Nico personally writes.

**Truth-in-claims rule:** Every client-facing claim must be true of the system as built. "Checked / verified / open and bookable" claims may not ship until Google Places verification is live.

---

## Service Model

Both tiers launch together at the end of Phase 5.

| Tier | Description |
|---|---|
| Itinerary Planning | Researched, composed itinerary with booking links; client books independently |
| Full-Service Concierge | Itinerary plus automated booking (Duffel flights/hotels, Viator tours) after explicit confirmation, with the client paying by card |

**Money rule:** No real booking executes unless the client's payment has succeeded. Bookings are never funded from the operator's Duffel balance for real trips.

---

## Technical Foundation — As Built

| Area | State |
|---|---|
| App | Expo SDK 56 universal app (React Native 0.85), `expo-dev-client`, `eas.json` with development/preview/production profiles |
| Monorepo | Turborepo, npm workspaces, 6 packages building clean |
| API | Express 4 + TypeScript; pipeline runs as direct async functions |
| Database | Local PostgreSQL/PostGIS `outbound_dev`, 26 migrations, ESM migration convention |
| Scoring | TVI: 7 travel dimensions, 7 traveler profiles, 11 signal categories, 170 countries scored |
| Maps | react-map-gl (web), @rnmapbox/maps (native), choropleth rendering |
| Intake | 4-step wizard, shared Zod schema in `@outbound/core`, Turnstile (web only today), honeypot, rate limit |
| Email | Resend (sandbox sender until a domain is registered) |
| LLM | AWS Bedrock — Haiku 4.5 (classification), Sonnet (composition and correspondence) |
| Booking | Duffel test mode, flights + Stays, payment currently from Duffel balance; Viator not integrated |
| Orchestration | Direct Express functions; n8n deferred |
| Admin | Server-rendered HTML dashboard, `ADMIN_EMAILS` authorization |
| Tests | 35 (23 golden scoring fixtures + 12 preference); Playwright web smoke script; no native test tooling |

### Known gaps, mapped to their Phase 4 step

| Gap | Step |
|---|---|
| Native app never launched; Mapbox download token and dependency drift unresolved | 1 |
| Verification email links to a nonexistent `/verify` route (broken on web too) | 2 |
| Verify endpoint is a GET that email link scanners can trigger | 2 |
| Turnstile renders nothing on native; server returns 403 once a secret key is set | 2 |
| Welcome overlay persistence is `localStorage` only | 2 |
| Trend chart is a text stub on native | 2 |
| Google OAuth callback hardcoded to `localhost:8081` | 2 |
| Orphaned `TravelerProfileSelect`, `IndustryVerticalSelect` | 2 |
| Free-text dates, "Invalid ISO date" on empty fields, UTC "today" bug, no maximum length or lead time | 3 |
| Inbound webhook unauthenticated and not idempotent | 4 |
| Email reply classified as confirmation can trigger booking | 4 |
| Response prompt tells the model it is "a real person" named Nico | 4 |
| Confirm link is a GET that link scanners can trigger | 4 |
| No client payment collection; bookings paid from Duffel balance | 5 |
| Executor ignores traveler data and hardcodes DOB, gender, title | 6 |
| Trip marked `booked` even when segments failed | 6 |
| Full-service path never run end to end (0 bookings) | 6 |
| Viator not integrated | 7 |
| Follow-ups triggered manually; duplicate protection via subject matching | 8 |
| `active`, `completed`, `cancelled` trip statuses never set | 8 |
| No cancellation or refund flows (`cancelBooking` is dead code) | 9 |
| No modification flows | 10 |
| Escalations carry no suggested-response draft; no approval queue | 11 |
| No tests for correspondence, payments, or booking | 12 |

---

## Phase 4 — Step Detail

**Step 1 — Native running.** Confirm the EAS CLI and account; link Outbound to its own EAS project (not GEXIS's); align dependencies; install the native packages needed through Step 3 (WebView, date picker) so one build covers Steps 1–3; configure Mapbox for native builds; build the development client on EAS; Nico installs it on his Pixel and connects over Wi-Fi; create `docs/parity-checklist.md` (Web verified by Cursor, Android by Nico).

**Step 2 — Parity and critical fixes.** Client `/verify` route (GET page → POST action) on web and native; Turnstile on native via a WebView loading from an allowed origin, with the same server check; shared storage helper; native trend chart behind the shared interface; config-driven OAuth callback (native redirect approach checked against Google's current requirements); delete orphaned components.

**Step 3 — Unified date field.** One `<DateField />` interface: `<input type="date">` on web, `@react-native-community/datetimepicker` on native. Required-field messages; plain-language errors; "today" based on the client's local date; maximum trip length 60 days; start within 18 months; picker `min` constraints; "flexible" kept as a composition signal; DOB error copy fixed.

**Step 4 — Correspondence hardening.** Webhook signature verification; message-ID idempotency; quoted-reply stripping; GET → POST confirmation page; an email reply expressing approval gets a response with the secure link and never triggers booking; prompt rewrite (Outbound voice, no human claim, no country list); `identity_query` escalation; final signature wording.

**Step 5 — Payments and ledger (test mode).** Opens with an audit of how Duffel and Viator each handle payment (charge vs hold, who is merchant of record, how refunds work) before the design is locked. Then: client card collection on web and native; payment state machine; `payments` and `refunds` ledger; the rule that no booking executes without successful payment. Handling a trip that mixes Duffel and Viator (one charge vs several, automatic refund on booking failure) is designed here.

**Step 6 — Duffel booking execution.** Traveler data model (replacing `communication_preferences` misuse); executor reads real traveler data; booking runs only after payment succeeds; partial failure escalates and triggers the refund path, instead of marking the trip `booked`; first full end-to-end full-service run in test mode.

**Step 7 — Viator.** Tours and experiences retrieved during composition and booked on the same payment-backed pipeline. If full booking access is not yet approved, composition still uses real Viator products and the itinerary falls back to booking links for those segments.

**Step 8 — Scheduler and lifecycle.** In-process scheduler; follow-up send log; `active` and `completed` transitions; 48-hour post-confirmation booking update; tightened 14-day and 2-day windows.

**Step 9 — Cancellations and refunds.** Duffel cancellation quote and Stays cancellation; Viator cancellation; terms sent to the client; tokenized confirm (GET page → POST); execution; refunds recorded in the ledger; booking and trip status updates; templates.

**Step 10 — Modifications.** Flight changes via Duffel order change requests; hotel and tour changes escalate with a suggested response.

**Step 11 — Admin operations.** Suggested-response drafts on escalations; cancellation/modification approval queue; booking pipeline monitor.

**Step 12 — Test suite.** Classifier parsing, router decisions, follow-up selection, payment and booking state transitions, cancellation flows; decision on native test tooling.

**Out of scope for Phase 4:** live payments, production deployment, domain/DNS, Google Places verification, the content overhaul, iOS builds.

---

## Phase 5 — Launch Readiness (detail)

- Google Places operational verification (`verification_cache`, fallback logic)
- Composition retry or JSON repair on `failed_parsing`
- Domain registration; Resend domain verification; SPF/DKIM/DMARC; inbound MX on the concierge subdomain
- App links: Android intent filters (and iOS associated domains if iOS ships)
- Content overhaul: About, intake, and email copy per the positioning policy; four-continents framing; final tier names and pricing
- Legal: Seller of Travel obligations by client state of residence (with a fallback of blocking unregistered states at checkout if needed), terms of service, privacy policy, AI-disclosure compliance, Outbound's cancellation and refund policy
- Live payments: payment provider verification completed, production keys
- Duffel and Viator production access, webhooks, account tiers
- Production deployment: Vercel web; API, PostgreSQL/PostGIS, and Redis host decided here
- Android release: EAS production build, Play Store internal testing, then production listing
- iOS build and release decision
- Security review: auth, rate limits, webhook security, PII and travel-document handling, payment security
- Performance baseline: composition latency, map rendering on web and Android, booking pipeline latency

**Deliverable:** The complete Outbound MVP, both tiers, live on web and Android.

---

## External Dependencies (start early — outside our control)

| Dependency | Why | Needed by |
|---|---|---|
| Viator partner API access (full booking tier, not only affiliate) | Booking tours through the API requires approval | Step 7 (fallback: booking links) |
| Duffel Payments enablement and business verification | Card collection; live mode requires business verification | Step 5 (test mode), Phase 5 (live) |
| Seller of Travel requirements (CA, FL, WA, HI, and others) | Registration or bonding may be required before taking funds | Phase 5 |
| Domain registration | Email authentication, inbound email, app links | Phase 5 |

---

## Future (not scoped, not scheduled)

n8n orchestration; destination knowledge base; new signal workers (WHO, NOAA/ECMWF, FlightAware); Open-Meteo seasonality; scoring config consolidation; destination style tagging; client portal; group coordination; itinerary templates; referral program; subnational scoring; conversational intake; marketplace reactivation; direct supplier or GDS access.

---

## Workflow Rules (non-negotiable)

1. Audit-first, always. No fixes in the same prompt as diagnostics.
2. One step at a time. One prompt → execute → review → approve → next.
3. Full-scope thinking before tactical execution.
4. Three failed fixes = fresh audit.
5. Flag mismatches immediately.
6. Lock decisions before execution.
7. Phase sealing: formal handoff committed to `docs/handoffs/`, merged to both `main` and `develop`. Roadmap versions live in `docs/roadmap/`.
8. Branch naming is purpose-driven (no phase numbers).
9. No timeline estimates.
10. **Parity gate.** No step merges unless verified on web and Android. Cursor verifies web; Nico verifies Android from the checklist Cursor provides. Merges happen after both.
11. **Fixed step list.** New findings slot into existing steps or the parked list. No steps added mid-phase.
12. **Stop and report.** When a precondition is missing or something unexpected happens, Cursor stops and reports instead of working around it.

---

## Decisions

### Resolved

| Decision | Resolution |
|---|---|
| MVP scope | Full scope, both tiers, single launch |
| Product architecture | One universal app; platform-specific code only behind shared interfaces |
| Android dev environment | EAS development build on Nico's Pixel; manual Android verification |
| iOS | Code stays compatible; release decided in Phase 5 |
| Step order | Payments (5) before Duffel (6) and Viator (7) |
| Email provider | Resend |
| LLM | Bedrock — Haiku (classify), Sonnet (compose/correspond) |
| Orchestration | Direct Express functions; n8n deferred |
| Booking providers | Duffel (flights/hotels), Viator (tours/experiences) |
| Booking trigger | Tokenized link only; GET page → POST action |
| Identity policy | Don't advertise, never deny; identity questions escalate |
| Correspondence voice | Outbound "we" voice; Nico named and reachable |
| Experience framing | Lived and worked across four continents |
| Turnstile on native | WebView from an allowed origin; same server check; no bypass |
| Verify link | Client `/verify` route; GET page → POST action |
| Date field | Single `<DateField />`; native HTML date input (web), datetimepicker (native) |
| Date bounds | Max 60 days; start within 18 months; local-date "today" |
| Flexible dates | Dates required; "flexible" is a composition signal |
| DOB (Phase 4) | Error copy only; passenger requirements handled in Step 6 |
| Native project files | Not committed; `app.json` is the source of truth |

### Open

| Decision | Resolve by |
|---|---|
| Shared storage library | Step 2 |
| Native chart implementation | Step 2 |
| Native OAuth redirect approach | Step 2 |
| Final signature and direct-contact wording | Step 4 |
| Payment processor and multi-provider payment design | Step 5 |
| Traveler data model shape | Step 6 |
| Price tolerance threshold (5% default) | Step 6 |
| Scheduler mechanism | Step 8 |
| Native test tooling | Step 12 |
| Domain | Phase 5 |
| iOS build and release | Phase 5 |
| Production hosting for API/DB/Redis | Phase 5 |
| Tier names and pricing | Phase 5 |
| Duffel account tier | Phase 5 |
