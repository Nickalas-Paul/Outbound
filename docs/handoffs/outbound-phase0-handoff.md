# Outbound — Phase 0 Command Center Handoff

## Purpose

This document initializes a dedicated Phase 0 (Clone, Strip, Rebrand) command center chat. It carries forward all decisions, context, and ready-to-execute artifacts from the project planning session.

---

## Attached Documents (required for this chat)

1. **outbound-project-spec-v2.md** — The authoritative project specification and phase plan. v2 supersedes v1. Contains the north star, two-tier service model, technical foundation, autonomous operation model, agentic architecture with booking pipeline, all six phases, workflow rules, and deferred decisions. Read in full before proceeding.

2. **GEXIS Technical Audit** — 24-section ground truth for the source repository (GEXIS_MVP at Phase 7.5, commit `52af7cb`). Covers architecture, scoring methodology, database schema, API inventory, marketplace system, auth, signal pipeline, devops state, testing gaps, and technical risks. This is what exists on disk before we touch anything.

---

## Claude's Role

Claude is the project command center and PM:

- **Architecture authority.** All decisions discussed, evaluated, and locked here before code is written.
- **Audit prompt drafting.** Diagnostic-only prompts for Cursor. Cursor reports findings and stops. No fixes in audit prompts.
- **Implementation prompt drafting.** After audit review and Nico's approval, Claude drafts precise, scoped implementation prompts. One at a time.
- **Roadmap enforcement.** Every prompt checked against the phase plan. Flag scope drift immediately.

Claude does NOT: write/execute code, make unilateral product decisions, skip audits, draft multiple implementation steps before verification, or provide timeline estimates.

**Nico** reviews all outputs, makes all final decisions, sends prompts to Cursor, and returns Cursor's reports.

**Cursor** (not in this chat) executes all code, git, and CLI operations.

---

## Workflow Rules (non-negotiable)

1. Audit-first, always. No fixes in the same prompt as diagnostics.
2. One step at a time. One prompt → execute → review → approve → next.
3. Full-scope thinking before tactical execution.
4. Three failed fixes = fresh audit.
5. Flag mismatches immediately.
6. Lock decisions before execution.
7. Phase sealing with formal handoff document and commits to both `main` and `develop`.
8. Branch naming is purpose-driven (no phase numbers).
9. No timeline estimates.

---

## Current State

- **Source repo:** GEXIS_MVP at Phase 7.5, commit `52af7cb`, fast-forward merged to both `main` and `develop`
- **Roadmap version:** v2 (locked)
- **Active phase:** Phase 0 — Clone, Strip, Rebrand

---

## Key Decisions Made in Planning Session

These are locked and should not be relitigated during Phase 0:

1. **Two-tier service model:** Full-service concierge (automated booking execution via Duffel) is the premium product. Itinerary-only planning is the lighter/cheaper option. Both tiers share one intake funnel with a service tier toggle at the end of the form.

2. **Duffel API** selected as booking infrastructure for flights and hotels. No IATA/ARC accreditation required. Merchant-of-record payment processing — Nico never touches card data. Tours/experiences API (Viator or equivalent) supplements Duffel — specific provider deferred to Phase 3.

3. **Structured confirmation gate:** Itineraries are delivered as drafts. Client must explicitly confirm before any bookings execute. Multiple revision rounds supported.

4. **Landing page UX direction:** The interactive Mapbox map IS the landing page. Intake form input fields are overlaid directly on the map (not behind a CTA to a separate page). Explore-first and plan-first visitors both start on the same screen. Full design is Phase 2 scope.

5. **Second-opinion feedback noted** (not actioned): email verification friction (consider letting composition begin before verification), n8n vs BullMQ (evaluate during Phase 3), availability vs verification language in itinerary copy (Phase 3 prompt engineering).

---

## Phase 0 Scope

**Objective:** Establish the Outbound repository from GEXIS_MVP. Clean foundation, building and running.

**Steps:**
- Clone GEXIS_MVP repo
- Flatten git history to a single initial commit
- Rename all packages, environment variables, and configs from GEXIS → Outbound
- Rename gexis-core shared package → outbound-core (or equivalent)
- Comment out the entire marketplace subsystem (preserve all code, disable routes and UI)
- Remove GEXIS-specific marketing copy, landing page content, B2B terminology
- Rename scoring references: MVI → TVI (or equivalent)
- Clean up GEXIS-specific assets, branding, icons
- Verify clean build: Turborepo builds, API starts, Expo web renders, database migrates
- Establish branch strategy: main and develop

**Deliverable:** Clean Outbound repo with new identity, building and running, marketplace commented out, all GEXIS-specific content removed, ready for Phase 1.

---

## Ready-to-Send: Phase 0 Opening Audit Prompt

The following audit prompt was drafted and reviewed in the planning session. It is ready to send to Cursor against the GEXIS_MVP repo as the first action of Phase 0.

---

**Context for Cursor:**

You are auditing the GEXIS_MVP repository at its current state (Phase 7.5, commit `52af7cb`, merged to both `main` and `develop`). This repository will be cloned and adapted into a new project called Outbound. Before any clone or modification work begins, we need to confirm that what exists on disk matches our technical documentation.

**This is a diagnostic-only audit. Report findings and stop. Do not attempt any fixes, modifications, renames, or code changes.**

**Report the following:**

**1. Repository structure**
- Confirm the top-level directory layout matches: `apps/universal/`, `packages/gexis-core/`, `packages/api-client/`, `packages/ui/`, `server/api/`, `server/db/`, `server/workers/`
- Note any directories or top-level files not listed above
- Confirm `turbo.json`, root `package.json`, and `.env.example` exist

**2. Package identity**
- List every `package.json` in the repo (root and nested) with its `name` field value
- List any references to "gexis" or "GEXIS" in package names, workspace declarations, or Turborepo pipeline configs
- Report the `gexis-core` package: what does it export? List its primary type definitions and configuration objects

**3. Marketplace subsystem footprint**
- List all files related to the marketplace: agent profiles, reviews, shortlists, engagements, marketplace search, agent onboarding, agent notification hooks
- Include both API routes (server-side) and UI screens/components (client-side)
- Report which database migration files create marketplace-related tables (`agents`, `agent_reviews`, `agent_engagements`, `user_shortlists`)

**4. Scoring engine**
- Locate the MVI scoring implementation: `compute_mvi.py`, dimension configs, normalization logic, missing-data redistribution, confidence classification
- Locate the trend computation: `compute_trends.py`, OLS logic, projection mechanics
- Locate the signal pipeline: worker files, signal categories, decay logic, adjustment caps
- Report the dimension definitions and their indicator mappings as currently configured
- Confirm the `mvi_scores` and `trend_scores` table schemas from the migration files

**5. Signal workers**
- List every Python worker file under `server/workers/` with a one-line description of what data source it targets
- Note which workers appear functional vs. which appear to be stubs or require external credentials not present in `.env.example`

**6. Authentication system**
- Confirm the auth implementation: email/password (Argon2id), Google OAuth, JWT access/refresh rotation, Redis-backed revocation
- List the auth-related API routes
- Confirm Passport is installed but not driving the current auth flow

**7. Database migrations**
- List all migration files in order with a one-line description of what each creates or modifies
- Confirm total count matches the documented 17 migrations

**8. Build and run verification**
- Run `npm install` at the root
- Run the Turborepo build command and report whether it succeeds or fails (and where it fails)
- Report whether the API server starts (it won't connect to a database, but confirm it doesn't crash on startup config)
- Report whether the Expo web build/start command initiates without errors

**9. Branch state**
- Confirm current branch
- Confirm `main` and `develop` exist and point to the same commit (`52af7cb`)
- Report any other branches present

**10. Anything unexpected**
- Files, directories, dependencies, or configurations that don't appear in the project documentation
- Any evidence of partial work-in-progress that wasn't committed cleanly
- Dead code, orphaned files, or configuration artifacts that would complicate a clean clone

---

## After the Audit

Once Cursor returns the audit findings, bring them to this chat. Claude will:
1. Review findings against the GEXIS Technical Audit document
2. Flag any mismatches between documented state and disk state
3. Identify any issues that affect the Phase 0 implementation plan
4. Draft the first implementation prompt (clone and flatten) once findings are reviewed and approved
