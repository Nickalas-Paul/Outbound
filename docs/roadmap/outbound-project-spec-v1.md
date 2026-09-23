# Outbound — Project Specification & Phase Plan

**Status:** Confirmed — ready for dedicated build chat and Phase 0  
**Origin:** Clone and adapt GEXIS_MVP repository  
**Source repo:** github.com/Nickalas-Paul/GEXIS_MVP (Phase 7.5, commit `52af7cb`)  
**Operator:** Nico (sole operator, architect, product owner)  
**Workflow:** Claude architects and drafts Cursor prompts. Cursor executes all code, git, CLI. Nico reviews and decides.

---

## North Star

A professional, dynamic travel intelligence and concierge platform where visitors land on an interactive geospatial explorer, get inspired by real data about destinations worldwide, and seamlessly move into a planning funnel — submitting trip requests that are composed, delivered, and managed through autonomous agentic AI workflows with human oversight reserved for genuine edge cases.

The website itself is the credential. Not travel photos, not blog posts about personal adventures — the product's sophistication, clarity, and usefulness is what earns trust. Lived international experience (Korea, Spain, Argentina, Mexico) informs voice, taste, and consultation availability, but does not serve as the marketing pitch.

---

## Product Vision

### Two entry points, one funnel

1. **Explore-first:** Visitor lands on the interactive world map. Countries are scored and color-coded across travel dimensions (safety, cost, accessibility, infrastructure, crowding, trajectory). Clicking a country reveals destination intelligence — dimension breakdowns, active signals, trend data, seasonal notes. Exploration builds intent, and a persistent "Plan This Trip" CTA converts that intent into the intake flow.

2. **Plan-first:** Visitor arrives knowing where they want to go. A prominent intake form captures destination, dates, group size, budget, preferences, and special requirements. Submission triggers the itinerary composition pipeline.

Both paths converge into the same backend: trip creation → AI-composed itinerary → autonomous delivery → email correspondence → revision cycles → booking support.

### What the client experiences

- A polished, responsive, data-rich destination explorer that feels like a tech product, not a travel agency brochure
- A clean intake process — no account creation required
- A professionally composed itinerary delivered by email
- Natural email correspondence for revisions, questions, and coordination
- A human available by phone or in person when the situation calls for it
- Real-time travel intelligence (safety signals, weather, disruptions) for their destination

### What Nico experiences

- A monitoring dashboard showing active trips, system activity, and the rare escalated item
- Autonomous itinerary composition and delivery that requires no routine review
- Email correspondence handled automatically for standard interactions
- Escalation only when the system genuinely cannot resolve a situation
- A platform that gets smarter over time as the destination knowledge base and itinerary template library grow

---

## Competitive Moat

Traditional travel agents compete on supplier relationships and volume. Outbound competes on:

- A live geospatial intelligence layer no boutique competitor can replicate
- Near-zero operational overhead through agentic automation
- Genuine lived international experience for high-touch consultations
- A product experience that feels like a tech platform, not a static website

---

## Revenue Model

- **Planning fees:** $200-400+ per trip depending on complexity (group size, multi-destination, duration)
- **Affiliate commissions:** Hotel and tour booking links embedded in itineraries generate passive commission (10-20% on tours/experiences, lower on hotels)
- **Consultation fees:** Optional paid phone/in-person consultation for clients who want direct guidance

Revenue scales with volume. Near-zero marginal cost per trip means the planning fee is almost entirely margin once infrastructure costs are covered.

---

## Technical Foundation — What GEXIS Provides

### Keeps (infrastructure stays as-is)

- Turborepo monorepo with npm workspaces
- Express 4 API with TypeScript, Helmet, CORS, rate limiting, request validation
- PostgreSQL/PostGIS database with node-pg-migrate migration tooling
- Full auth system: email/password (Argon2id), Google OAuth, JWT access/refresh rotation, Redis-backed revocation
- Mapbox GL integration: react-map-gl for web, @rnmapbox/maps for native, pinned at 3.20.0/7.1.7
- Expo 56 universal app shell (web + Android native) with platform-specific map rendering
- Tier/feature gating infrastructure (GEXIS_GATING_ENABLED flag pattern)
- Health and readiness endpoints
- gexis-core shared package pattern for domain types and product rules
- PDFKit and CSV Stringify export infrastructure
- Natural Earth GeoJSON country geometry data
- Environment variable management pattern
- Google OAuth integration (GCP project)

### Adapts (same architecture, new configs/data)

**Scoring engine → Travel Viability Index (TVI):**

The MVI config-driven scoring engine stays intact — dimensions, weighted indicators, normalization (linear min-max and logarithmic), missing-data redistribution, confidence classification (high/medium/low), data provenance, and query-time profile reweighting. Only the dimension definitions and data sources change.

| GEXIS MVI Dimension | Outbound TVI Dimension | Key Sources |
|---|---|---|
| Market Size & Growth | Tourism Infrastructure & Capacity | UNWTO tourism statistics, hotel density, airport connectivity, tourist arrivals |
| Talent Density | Accessibility & Ease of Travel | EF English Proficiency Index, visa complexity databases, public transit quality |
| Tax Environment | Cost Index | IMF PPP (already ingested), Numbeo cost-of-living, hotel price indices, meal/transport costs |
| Regulatory Ease | Entry Requirements & Safety | State Department advisories (worker exists), WGI rule of law/corruption (already ingested), visa-free access scores |
| Infrastructure | Travel Infrastructure | Electricity/internet access (already ingested), healthcare density (WHO), tourism-specific infrastructure |
| Competitor Saturation | Tourism Crowding | Tourists per capita, overtourism indicators, seasonal concentration |
| Trajectory | Trajectory | Same OLS trend analysis, same projection mechanics, same confidence intervals, new inputs |

**Industry profiles → Traveler profiles:**

Same query-time reweighting architecture, new profile configs:

- Solo backpacker (weights cost and safety high, crowding negative)
- Couple / honeymoon (weights infrastructure and safety high, cost moderate)
- Family (weights safety highest, infrastructure high, cost moderate)
- Group / tour (weights infrastructure and capacity high, accessibility high)
- Luxury (weights infrastructure highest, cost inverted — higher cost acceptable)
- Budget (weights cost highest, crowding tolerance higher)

**Signal pipeline:**

The 10-worker ingestion architecture, market_signals table, 7-day decay logic, √n diminishing returns, per-signal adjustment cap, and projection-only modification rule all stay intact.

Existing workers that transfer directly to travel:
- GDELT (global event monitoring)
- ACLED (conflict data) — access pending
- GDACS (natural disaster alerts)
- US State Department travel advisories
- Currency/FX feeds (Frankfurter/ECB)
- NewsAPI — licensing deferred

New signal workers to add:
- Airline disruption feeds (FlightAware API or equivalent)
- WHO disease outbreak monitoring (RSS/API)
- Festival and major event calendars (structured data sources)
- Extreme weather alerts (NOAA, ECMWF)

**Other adaptations:**
- mvi_scores table → renamed destination_scores (same schema)
- trend_scores table → same structure, travel dimensions
- Explorer UI → relabeled and restyled for travel context
- Country detail page → destination intelligence page
- Comparison workflow → destination comparison
- Filter controls → travel-relevant parameters (budget range, trip type, season, safety threshold)
- PDF/CSV export → destination intelligence reports and client itineraries

### Comments out (preserved for future use)

The entire marketplace subsystem is commented out — code preserved, routes disabled, UI hidden:

- Agent profiles, onboarding, and search
- Reviews and ratings
- Shortlists
- Engagement lifecycle (requested → accepted → active → completed)
- Marketplace-specific notifications
- Agent notification hooks from signal pipeline
- Full-text search with GIN indexing for marketplace discovery

**Future potential:** Local guide marketplace, excursion provider directory, vetted vendor network. The schema, lifecycle logic, and search infrastructure remain in the codebase for when this becomes relevant.

### Adds (net new — no GEXIS equivalent)

- Trip management system (intake, trip entity, status lifecycle)
- Itinerary composition engine (AI-powered, multi-day, structured output)
- Operational status verification layer (Google Places API for business validation)
- Email correspondence system (inbound parsing, classification, autonomous response, escalation)
- Automated follow-up sequences
- Admin monitoring dashboard
- Agentic workflow orchestration (n8n)
- LLM integration (first AI/LLM calls in this codebase)
- Destination knowledge base (curated per-destination data enriching AI output)
- Anti-abuse layer (CAPTCHA, rate limiting, email verification)

---

## New Database Schema (additions to existing GEXIS tables)

### clients
- Contact info (name, email, phone), communication preferences
- Linked to users table if they create an account, standalone if email-only
- Verified flag (email verification completed)
- Trip history

### trips
- Master record: destination(s), dates, group size, budget range
- Trip type: solo, couple, family, group
- Point of contact (for group trips)
- Special requirements: accessibility, dietary, religious, mobility
- Status lifecycle: intake_received → composing → delivered → in_revision → confirmed → active → completed
- Escalation flag and reason (if applicable)

### itinerary_versions
- Linked to trip
- Version number
- Structured JSON content: day-by-day with locations, accommodations, activities, logistics, pricing, booking links
- Rendered PDF/HTML file path
- Status: draft → sent → superseded
- Composition metadata: which candidates were considered, which were skipped and why

### correspondence
- Email thread per trip
- Each message: direction (inbound/outbound), raw content, AI classification, confidence score
- Escalation flag and reason
- Auto-sent vs. manually sent indicator

### destinations
- Curated knowledge base entries per destination
- Insider tips, seasonal recommendations, practical notes
- Linked to geography records from GEXIS
- Grows over time as trips are completed and knowledge accumulates

### verification_cache
- Business operational status checks (Google Places results)
- Cached per business with TTL (30-day freshness window)
- Prevents redundant API calls for businesses recently verified

---

## Autonomous Operation Model

Outbound operates autonomously by default. Human involvement is the exception, not the rule.

### Itinerary composition — fully autonomous

The system composes and delivers itineraries without human review. Quality is ensured through:

**Operational status verification:** Every hotel, tour operator, and experience provider recommended in an itinerary is validated against Google Places API (or equivalent) for operational status. A business qualifies as verified if it has a live Google listing, reviews within the last ~30 days, and an active website.

**Automatic fallback:** If the top candidate for any itinerary segment fails verification, the system silently moves to the next best match. No flag, no pause. It picks the next option that meets the parameters and passes verification.

**Escalation triggers (genuinely rare):**
- No verified candidates exist for a required itinerary segment (e.g., extremely remote destination with no verifiable accommodations)
- The only discoverable candidate has ambiguous operational status and there are no alternatives
- These produce an async notification to Nico with context and a suggested path forward — they do not block the rest of the itinerary from being composed

### Email correspondence — autonomous with narrow escalation

All routine client communication is handled by the AI email agent:
- Revision requests → agent regenerates the affected segment and sends updated itinerary
- Factual questions → agent drafts and sends response
- Confirmations → agent acknowledges and updates trip status
- Follow-ups → automated sequences (post-delivery check-in, pre-trip reminder, post-trip feedback)

**Escalation triggers:**
- Client explicitly requests to speak with a person
- Complaint or negative emotional tone detected
- Money disputes or refund requests
- Emergency situations (cancellations, medical, safety)
- Agent confidence below threshold on classification or response

Escalated items arrive in the admin dashboard with full conversation context and a suggested response Nico can edit and send.

### Correspondence tone

Defined by a system prompt with tone direction and guiding principles — warm but professional, concise, no corporate filler, helpful without being obsequious. Not trained on personal email correspondence. A small set of purpose-written template examples (2-3 initial outreach emails, revision responses, follow-ups) establishes the voice baseline. The goal is "competent, personable travel professional," not a personal voice clone.

---

## Anti-Abuse & Security

No account creation required before submitting a trip request. Conversion matters more than gatekeeping.

### Protection layers

1. **CAPTCHA:** Cloudflare Turnstile on the intake form (free, less intrusive than reCAPTCHA)
2. **Rate limiting:** Per-IP throttling on the intake endpoint (already have Express rate limiting infrastructure from GEXIS)
3. **Honeypot fields:** Hidden form fields that bots fill and humans don't — submissions with honeypot data are silently discarded
4. **Email verification gate:** Form submission triggers a confirmation email. The itinerary composition pipeline only fires once the client clicks the verification link. This confirms a real human with a real email address without requiring account creation, and establishes the verified email address needed for ongoing correspondence
5. **Basic validation logic:** Nonsensical submissions (empty destinations, impossible date ranges, clearly fake data) are rejected before reaching the pipeline

---

## Agentic Architecture

### Orchestration: n8n (self-hosted or cloud — decision deferred to Phase 3)

All workflows run in n8n, triggered by webhooks and schedules. No custom orchestrator framework.

### Model strategy: split by task

**Open source models (inference provider TBD — Together AI, Groq, or Bedrock-hosted Llama/Mistral) for internal pipeline:**
- Intake form parsing and structuring
- Email classification (revision / question / confirmation / complaint / escalation)
- Change request extraction from client replies
- Search query generation for destination research
- Routing decisions within workflows
- Cost calculations and comparison logic

**Frontier model via AWS Bedrock API (Claude) for client-facing output:**
- Itinerary narrative composition
- Email correspondence drafting
- Complex/ambiguous client request handling
- Escalation summaries for admin dashboard

Note: Claude Pro subscription does NOT provide API/Bedrock access. Bedrock is separate, pay-per-use billing. Estimated cost at low volume: < $5/month.

### Workflow 1: Intake → Itinerary → Delivery

```
Intake form submission (webhook)
  → CAPTCHA validation + honeypot check
  → Parse and structure trip parameters (open source model)
  → Send email verification to client
  → [Client clicks verification link]
  → Create trip record in database (status: composing)
  → Research destinations:
      - Query destination_scores and active signals from database
      - Query destination knowledge base
      - Web search for current hotel/tour/experience options
  → For each itinerary segment:
      - Identify candidate businesses
      - Verify operational status (Google Places API, check cache first)
      - If top candidate fails verification → silently move to next match
      - If NO candidates pass verification → flag segment, continue composing rest
  → Compose itinerary narrative (Claude via Bedrock)
  → Format as PDF (existing PDFKit infrastructure)
  → If any segments were flagged:
      → Notify Nico via admin dashboard with context
      → Hold flagged segments, deliver the rest or wait based on severity
  → If no flags:
      → Send itinerary email to client automatically
      → Create correspondence record
      → Update trip status: delivered
```

### Workflow 2: Email Correspondence

```
Inbound email received (webhook from email provider)
  → Match to existing trip/client via sender address
  → Pull conversation history from database
  → Classify intent (open source model):
      revision | question | confirmation | logistics | complaint | escalation_request | other

  IF routine (revision, question, confirmation, logistics):
    → Extract specific requests if applicable (open source model)
    → If revision: regenerate affected itinerary segment (re-verify businesses)
    → Draft response (Claude via Bedrock)
    → Send automatically
    → Log in correspondence table

  IF escalation trigger (complaint, explicit human request, low confidence, money dispute, emergency):
    → Package: full conversation history + classification + suggested response
    → Notify Nico via admin dashboard
    → Nico reviews, edits, and sends
```

### Workflow 3: Automated Follow-ups

```
Scheduled triggers:
  → 48 hours post-delivery with no client response → gentle follow-up
  → 2 weeks before trip start → pre-departure email with latest signals for destination(s)
  → 1 week post-trip → feedback request and review solicitation
```

---

## Infrastructure & Estimated Costs

| Item | Cost | Notes |
|---|---|---|
| VPS/EC2 for n8n | $20-50/mo | Self-hosted; n8n Cloud is an alternative |
| PostgreSQL (Render) | $7-25/mo | Inherited from GEXIS deployment plan |
| Redis (Render) | Included or minimal | Inherited from GEXIS |
| Bedrock API | < $5/mo | Pay-per-use, low volume |
| Open source inference | < $5/mo | Together AI or Groq, pay-per-use |
| Email service | $10-15/mo | Postmark or SendGrid (decision deferred) |
| Website hosting (Vercel) | Free | Inherited from GEXIS |
| Mapbox | Free | Free tier covers low volume |
| Google Places API | ~$5-10/mo | Verification checks, cached aggressively |
| Domain + DNS | ~$12/yr | getoutbound.something |
| **Total** | **~$60-120/mo** | **Before first client** |

---

## Phase Plan

Every phase follows the established workflow: begins with a diagnostic audit, proceeds one step at a time (one prompt → execute → review → approve → next), and concludes with a sealed handoff document committed to both main and develop.

---

### Phase 0: Clone, Strip, Rebrand

**Scope:** Establish the Outbound repository from GEXIS_MVP. Clean foundation, building and running.

**Steps:**
- Clone GEXIS_MVP repo
- Flatten git history to a single initial commit
- Rename all packages, environment variables, and configs from GEXIS → Outbound
- Rename gexis-core shared package → outbound-core (or equivalent)
- Comment out the entire marketplace subsystem: agent profiles, reviews, shortlists, engagements, marketplace search, agent onboarding, marketplace-specific API routes, agent notification hooks. Preserve all code in place, disable routes and UI references
- Remove GEXIS-specific marketing copy, landing page content, B2B terminology from UI
- Rename scoring references in code: MVI → TVI (or equivalent travel terminology)
- Clean up any GEXIS-specific assets, branding, icons
- Verify clean build: Turborepo builds, API starts, Expo web renders, database migrates, tests (if any) pass
- Establish branch strategy: main and develop

**Deliverable:** Clean Outbound repo with new identity, building and running, marketplace commented out, all GEXIS-specific content removed, ready for travel-specific work.

---

### Phase 1: Scoring Engine Adaptation

**Scope:** Rewire the intelligence layer for travel data. The scoring engine is the core asset — protect the math, then change the inputs.

**Steps:**
- Audit existing scoring engine: normalization logic, missing-data redistribution, confidence classification, query-time reweighting, data provenance
- Write golden-fixture tests for the scoring engine BEFORE changing any inputs (deterministic test: same raw data in → same scores out, verifying normalization, missing-data handling, confidence levels, and reweighting all survive refactoring)
- Define TVI dimension configs: indicator mappings, weights, source definitions, normalization rules (log vs linear), inversion rules
- Define traveler profile configs with dimension weight overrides
- Adapt existing Python data workers to pull from travel-relevant sources (prioritize freely available APIs first: World Bank tourism stats, State Department advisories, open visa databases, cost-of-living indices)
- Verify existing signal workers (GDELT, GDACS, currency/FX, US travel advisories) produce meaningful travel signals without modification — retarget signal categories for travel context
- Update outbound-core with new dimension definitions, traveler profiles, and signal categories
- Run full scoring pipeline end-to-end: ingest → normalize → score → store
- Verify heatmap renders travel scores correctly in the explorer UI (labels will still be rough — visual polish is Phase 2)

**Deliverable:** Working travel intelligence heatmap with real data, scored across travel dimensions, with active signal overlays and traveler profile reweighting. Golden-fixture tests protecting the scoring math.

---

### Phase 2: Explorer UI & Public Experience

**Scope:** Transform the explorer into a travel destination platform that inspires visitors and converts them into clients. This is where the product becomes Outbound.

**Steps:**
- Audit current explorer UI components, navigation structure, and responsive behavior
- Design and implement new visual identity: color system, typography, spacing, component styling
- Restyle heatmap visualization, legend, tooltips, and filter panels for travel context
- Build destination intelligence page (replaces GEXIS country detail): dimension breakdowns with travel-relevant labels, active signals with travel framing, trend charts, seasonal notes, practical travel information
- Build destination comparison view with travel-relevant framing
- Implement "Plan This Trip" CTA integrated throughout the explorer experience
- Build the intake form:
  - Trip type (solo, couple, family, group)
  - Destination(s) — can be pre-filled from explorer context
  - Travel dates with flexibility indicator
  - Group size (with point-of-contact field for groups)
  - Budget range per person
  - Accommodation style
  - Interests and must-do experiences
  - Special requirements (accessibility, dietary, mobility, religious)
  - Anything already booked
  - Honeypot fields (hidden, anti-bot)
- Integrate Cloudflare Turnstile CAPTCHA on intake form
- Build the landing/home experience: the map IS the landing page, with clear value proposition overlay, service explanation, and intake CTA
- Build About page as a navigation tab: professional, concise, focused on the platform's capabilities rather than personal travel scrapbook
- Ensure full responsive behavior across desktop, tablet, and mobile
- Rate-limit the intake endpoint

**Deliverable:** A complete, professional, responsive public-facing travel platform. Visitors can explore scored destinations on an interactive map, drill into destination intelligence, compare destinations, and submit trip requests through a clean intake form with anti-abuse protections.

---

### Phase 3: Itinerary Composition Engine

**Scope:** Build the AI-powered trip planning pipeline from intake to delivery.

**Steps:**
- Set up n8n instance (self-hosted or cloud — make the call here)
- Select and configure open source model inference provider (Together AI, Groq, or Bedrock-hosted)
- Configure Bedrock API access for Claude (client-facing composition)
- Build intake processing workflow: form webhook → parse → email verification → trip record creation
- Build email verification flow: send verification link → client clicks → pipeline triggers
- Build destination research aggregation: pull from destination_scores, signals, knowledge base, and web search
- Build operational status verification layer:
  - Google Places API integration for business validation
  - Verification cache table with 30-day TTL
  - Verification decision logic: recent reviews + active listing + working website = verified
- Build itinerary composition chain:
  - Trip skeleton (routing, pacing, nights-per-location based on traveler profile)
  - Segment-by-segment accommodation and activity research with verification
  - Automatic fallback to next candidate on verification failure
  - Escalation flag only when no verified candidates exist for a segment
  - Narrative composition via Claude/Bedrock with structured itinerary data
  - PDF formatting using existing PDFKit infrastructure
- Build itinerary versioning in database
- Set up email delivery provider (Postmark or SendGrid — make the call here)
- Build email templates for itinerary delivery
- Build minimal admin view: pending escalations, recent trips, system status
- End-to-end test: intake submission → email verification → AI composition → verification checks → autonomous delivery OR escalation

**Deliverable:** Working autonomous pipeline from trip request to delivered itinerary. System handles composition and delivery without human review. Escalation triggers only on genuinely unresolvable situations.

---

### Phase 4: Email Correspondence System

**Scope:** Automated client communication lifecycle with escalation for edge cases.

**Steps:**
- Set up inbound email parsing (email provider's inbound webhook)
- Build email-to-trip matching (sender address → active trip lookup)
- Build conversation history retrieval for full context
- Build email classification pipeline (open source model): revision, question, confirmation, logistics, complaint, escalation request, other
- Build change request extraction for revision handling (open source model)
- Build itinerary segment regeneration for revision requests (reuses Phase 3 composition chain with re-verification)
- Build response generation via Claude/Bedrock with correspondence tone system prompt
- Build autonomous send pipeline for routine classifications
- Build escalation routing: complaint, money, emergency, explicit human request, low confidence → admin dashboard with conversation context and suggested response
- Build correspondence tracking and logging in database
- Build automated follow-up sequences:
  - 48-hour post-delivery follow-up (no client response)
  - 2-week pre-trip check-in with latest destination signals
  - 1-week post-trip feedback request
- Build email queue view in admin dashboard (outbound history, escalated items, auto-sent items)
- Implement Nico's edit-and-send flow for escalated items
- End-to-end test: client reply → classification → autonomous response OR escalation → Nico intervention → manual send

**Deliverable:** Functioning email agent handling routine correspondence autonomously. Escalation pipeline delivers edge cases to admin dashboard with full context. Automated follow-up sequences running on schedule.

---

### Phase 5: Admin Dashboard & Production Polish

**Scope:** Complete the operator experience, add enrichment layers, and prepare for production deployment.

**Steps:**
- Build full admin monitoring dashboard:
  - Active trips overview with status indicators
  - Trip detail view: itinerary versions, correspondence history, client info, escalation log
  - Escalation inbox with conversation context and suggested responses
  - Email activity log (auto-sent, escalated, manually sent)
  - System health: pipeline status, signal freshness, verification cache stats
- Build destination knowledge base management:
  - CRUD interface for per-destination curated content
  - Insider tips, seasonal recommendations, practical notes
  - This data enriches AI-composed itineraries over time
- Implement traveler profile selection in the explorer UI (currently backend-only from Phase 1)
- Add new signal source workers:
  - Airline disruption feeds
  - WHO disease outbreak monitoring
  - Festival and major event calendars
  - Extreme weather alerts
- Production deployment:
  - Vercel for web (inherited from GEXIS plan)
  - Render for API, PostgreSQL/PostGIS, Redis (inherited from GEXIS plan)
  - n8n production configuration
  - Environment variable management for production
  - Domain and DNS configuration
- Security review:
  - Auth flow audit
  - API protection verification
  - Email handling security (SPF, DKIM, DMARC)
  - Data privacy review (client PII handling)
  - Rate limiting verification across all public endpoints
- Performance baseline: response times, pipeline throughput, map rendering

**Deliverable:** Fully operational Outbound platform deployed to production. Admin dashboard for monitoring. Destination knowledge base seeded and growing. Ready to accept real clients.

---

### Future Phases (not scoped, not scheduled)

These are logged for future consideration. None affect the current build plan.

- **Vendor/guide marketplace:** Uncomment and adapt the GEXIS marketplace for excursion providers, local guides, vetted accommodation partners
- **Group coordination tools:** Shared trip pages for group members, individual preference collection, split payment tracking
- **Client portal:** Authenticated client experience with trip history, active itinerary view, correspondence archive, document access
- **Itinerary template library:** Pre-built templates by destination and trip type that accelerate composition and improve consistency
- **Referral program:** Word-of-mouth tracking and incentives, optimized for the demographic most likely to refer (established neighborhood networks)
- **Stripe integration:** Online payment processing for planning fees
- **Subnational depth:** City-level and regional scoring (GEXIS schema already supports states, metros, municipalities — data pipeline needs extension)
- **Conversational intake:** Chat-based trip planning as an alternative to the form, using the same composition pipeline

---

## Workflow Rules (inherited from GEXIS, non-negotiable)

These rules govern every phase and every prompt:

1. **Audit-first, always.** Every phase begins with a diagnostic audit. Cursor reports findings and stops. No fixes attempted in the same prompt as diagnostics. Nico and Claude review findings, then a separate implementation prompt is drafted after sign-off on root cause.

2. **One step at a time.** One prompt → Cursor executes → Claude reviews report → approval → next prompt. Never draft multiple implementation steps at once before any are verified.

3. **Full-scope thinking before tactical execution.** Complete implementation plan before any prompts are drafted, not incremental narrowing mid-execution.

4. **Three failed fixes = fresh audit.** If the same issue fails to resolve after three attempts, stop patching and run a new diagnostic audit from scratch.

5. **Flag mismatches immediately.** Documentation vs. disk, assumptions vs. reality, expected state vs. actual state.

6. **Lock decisions before execution.** Architectural choices, weight allocations, infrastructure decisions, and product calls are approved at a high level before Cursor executes.

7. **Phase sealing.** Each phase concludes with a formal handoff document and commits to both main and develop (fast-forward merges). main receives a merge at each phase completion as a stable checkpoint.

8. **Branch naming is purpose-driven.** No phase numbers or ordering references in branch names (e.g., feature/intake-form, not feature/phase-2-intake).

9. **No timeline estimates.** No duration forecasts in any project context.

---

## Deferred Decisions (resolve during indicated phase)

| Decision | Options | Resolve By |
|---|---|---|
| Domain registration | getoutbound.com, getoutbound.co, outbound.travel, etc. | Before Phase 3 (email setup) |
| Email delivery provider | Postmark vs. SendGrid vs. alternatives | Phase 3 |
| n8n hosting | Self-hosted VPS vs. n8n Cloud | Phase 3 |
| Open source model inference | Together AI vs. Groq vs. Bedrock-hosted Llama/Mistral | Phase 3 |
| Google Places API billing | Pay-per-use, monitor volume | Phase 3 |

---

## Reference: GEXIS Technical Audit

The complete GEXIS technical audit (24 sections covering executive summary, architecture, scoring methodology, database schema, API inventory, marketplace, auth, devops, testing gaps, and recommendations) should be included in the dedicated build chat initialization alongside this spec. It provides the ground truth for what exists in the source repository.
