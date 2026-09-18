# Outbound — Global Expansion Intelligence System

B2B geospatial market-entry intelligence platform with country-level risk scoring across 166 countries.

## What This Is

A full-stack data pipeline that aggregates geopolitical, economic, and regulatory indicators to produce composite market-entry scores for enterprise decision support. Built as a monorepo with a TypeScript/React frontend (Expo Router for web and mobile), a Python scoring engine, and a Node.js API server. Designed around the problem of helping businesses evaluate international expansion targets using structured, comparable data rather than ad hoc research.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | TypeScript, React, Expo Router (universal web + mobile) |
| Mapping | Mapbox GL for interactive heatmap visualizations |
| API Server | Node.js / Express |
| Scoring Engine | Python — composite risk model across multiple indicator categories |
| Data Sources | GDACS, OpenSanctions, currency volatility feeds, state department advisories |
| Infrastructure | Turborepo workspaces, server-side PDF and CSV export |

## What It Does

- **Country Risk Scoring:** Aggregates indicators across categories (political stability, regulatory environment, economic volatility, sanctions exposure, natural disaster risk) into a composite Travel Viability Index (TVI) for each country.
- **Interactive Heatmap:** Color-coded global visualization allowing comparative assessment across regions and indicator categories.
- **Agent Signal Notifications:** Automated monitoring layer that flags material changes in country risk profiles.
- **Export:** Server-side PDF and CSV generation for downstream reporting and stakeholder presentations.

## Design Decisions

- **Structured scoring over narrative reports.** The platform produces comparable numeric outputs, not written summaries. This makes it useful for portfolio-level screening across dozens of markets simultaneously.
- **Universal app architecture.** Expo Router serves both web and mobile from a single codebase, reducing maintenance surface for a solo developer.
- **Feature gating.** Tier types and feature flags are configured at the environment level, supporting a potential multi-tenant SaaS model without code branching.

## Project Status

Phase 8 complete. Core scoring engine, data integrations, heatmap visualization, and export endpoints are functional. Currently maintained as a portfolio reference — cloud services (Render, Vercel) decommissioned to local-only development.
