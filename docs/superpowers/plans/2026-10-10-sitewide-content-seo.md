# Sitewide Content SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the intent fit, evidence-led E-E-A-T, content hierarchy,
FAQ alignment, internal paths and enquiry guidance of all 33 canonical pages
without changing the Ellis brand voice or deploying the site.

**Architecture:** Preserve the current static HTML site and canonical URL set.
Add a small, HTML-parsing regression suite that guards page-level content
promises, then make focused copy and linking changes in four page families:
global hubs, commercial services, advice guides and canonical locality pages.

**Tech Stack:** Static HTML, JSON-LD, Node.js built-in modules, existing Vercel
static build and Node test scripts.

**Spec:** `docs/superpowers/specs/2026-10-10-sitewide-content-seo-design.md`

## Global Constraints

- The supplied keyword map is an intent/prioritisation reference, not proof of
  search volume, capability, coverage or a new-URL brief.
- Use only existing site evidence: ABR link, published project photos, contact
  details, on-site assessment/written quote process and written warranty terms.
- Do not invent licences, insurance, review scores, warranty periods, prices,
  response times, emergency availability, results, materials or coverage.
- Keep repairs, gutter cleaning and roof cleaning distinct; do not add a roof
  cleaning service or proposed owner URLs.
- Preserve all canonical URLs, redirects, sitemap population, forms, APIs,
  analytics and Vercel configuration.
- Keep one H1 per page, descriptive internal anchors and visible FAQ/schema
  answer equivalence.
- Use Australian English and the existing plain, practical, assessment-first
  Ellis tone.
- Do not push or deploy. End with a local `127.0.0.1` preview only.

## Review Focus

- A service page must never imply roof cleaning simply because it discusses
  gutter cleaning; Task 2 guards the service-boundary language.
- A written warranty must retain coverage/duration/exclusions wording without
  inventing a number; Task 1 guards the exact FAQ wording.
- FAQ schema answers must remain identical to rendered answers after editing;
  Task 1 parses and compares all FAQ pairs.
- Canonical locality pages must be improved without implying unverified local
  work or extending coverage; Task 4 guards the enquiry/assessment boundary.
- The source root, not the stale ZIP, is what Vercel builds; Task 5 runs the
  configured build and serves the generated output.

---

### Task 1: Establish content SEO regression checks and improve global hubs

**Files:**
- Create: `tests/content-seo.test.mjs`
- Modify: `index.html`
- Modify: `about.html`
- Modify: `services.html`
- Modify: `service-areas.html`
- Modify: `faq.html`
- Modify: `contact.html`

**Interfaces:**
- Consumes: the 33 canonical URLs in `sitemap.xml`.
- Produces: `node tests/content-seo.test.mjs`, a reusable static-content
  validation command used by Tasks 2–5.

- [ ] **Step 1: Write the failing global-content checks**

  In `tests/content-seo.test.mjs`, use `node:fs`, `node:path` and
  `node:assert/strict` to assert that every sitemap destination has exactly one
  H1, a non-empty title and meta description; Home/Services/Service Areas/FAQ/
  Contact each include an assessment/enquiry route; About includes the current
  ABR URL; FAQ visible warranty answer and FAQPage answer both equal
  `Written warranty information sets out coverage, duration and exclusions for the repair work.`

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node tests/content-seo.test.mjs`

  Expected: FAIL because the global evidence and conversion assertions are not
  all present before the content changes.

- [ ] **Step 3: Improve global page copy and paths**

  Keep page layout and H1s. Add concise, answer-first sections that route users
  to the appropriate existing service or guide, make the assessment/written
  quote process explicit, expose the About/ABR and written-warranty trust path,
  and ask only for safe, ground-level enquiry information. On Services, clarify
  the five current service boundaries; on Service Areas, clarify that suburb and
  access details are confirmed for an on-site appointment. Keep FAQ schema and
  visible answers byte-equivalent after normalising HTML whitespace.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `node tests/content-seo.test.mjs`

  Expected: PASS with a clear assertion count for 33 sitemap pages and five
  global trust/conversion destinations.

- [ ] **Step 5: Commit the global-content slice**

  ```bash
  git add tests/content-seo.test.mjs index.html about.html services.html service-areas.html faq.html contact.html
  git commit -m "feat: strengthen global content SEO paths"
  ```

### Task 2: Deepen five commercial service pages

**Files:**
- Modify: `roof-repairs-adelaide.html`
- Modify: `roof-leak-repairs-adelaide.html`
- Modify: `roof-restoration-adelaide.html`
- Modify: `gutter-downpipe-repairs-adelaide.html`
- Modify: `gutter-cleaning-adelaide.html`
- Test: `tests/content-seo.test.mjs`

**Interfaces:**
- Consumes: global trust paths from Task 1 and existing service-page JSON-LD.
- Produces: descriptive service-to-guide/service-to-service paths consumed by
  Task 3 and locality-page links in Task 4.

- [ ] **Step 1: Add failing commercial-intent assertions**

  Extend `tests/content-seo.test.mjs` to assert each commercial page has a
  visible project-photograph label, a scope/assessment section, an existing
  guide link, a link to an adjacent relevant service, an About trust link and a
  contact/form route. Assert the gutter-cleaning page says cleaning and repairs
  are quoted separately, while no commercial page claims roof-cleaning service.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node tests/content-seo.test.mjs`

  Expected: FAIL against one or more missing semantic path assertions.

- [ ] **Step 3: Add intent-led, evidence-safe service copy**

  Add short H2/H3 sections and internal links for the P1 intent clusters:
  leaks; tiles/ridge/flashing/valleys; drainage joints/outlets/downpipes;
  gutter debris/accessibility; and repair-first restoration. Explain what an
  on-site assessment confirms, what the visitor can record safely from ground
  level, and the next appropriate existing page. Use existing project galleries
  as labelled evidence without adding outcomes or new project facts.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `node tests/content-seo.test.mjs`

  Expected: PASS; the suite reports all five commercial pages satisfy their
  intent, proof, safety and conversion contracts.

- [ ] **Step 5: Commit the commercial-content slice**

  ```bash
  git add tests/content-seo.test.mjs roof-repairs-adelaide.html roof-leak-repairs-adelaide.html roof-restoration-adelaide.html gutter-downpipe-repairs-adelaide.html gutter-cleaning-adelaide.html
  git commit -m "feat: deepen commercial roofing content"
  ```

### Task 3: Improve advice cluster and informational-to-service journeys

**Files:**
- Modify: `industry-answers.html`
- Modify: `roof-repairs-adelaide-guide.html`
- Modify: `roof-leak-repairs-adelaide-guide.html`
- Modify: `tile-roof-repairs-adelaide-guide.html`
- Modify: `roof-repointing-ridge-capping-adelaide-guide.html`
- Modify: `gutter-downpipe-repairs-adelaide-guide.html`
- Modify: `roof-restoration-adelaide-guide.html`
- Test: `tests/content-seo.test.mjs`

**Interfaces:**
- Consumes: the five commercial destinations from Task 2.
- Produces: answer-first guidance paths with source-compatible safety and CTA
  language.

- [ ] **Step 1: Add failing advice-path assertions**

  Extend `tests/content-seo.test.mjs` to assert every guide has an answer-first
  introduction, one H1, at least three H2 sections, a descriptive link to its
  matching commercial page and a contact route. Assert Industry Answers links
  to all six guides and at least five commercial services.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node tests/content-seo.test.mjs`

  Expected: FAIL where guides or the hub lack the required existing-service
  paths.

- [ ] **Step 3: Write concise answer-first guidance**

  Improve each guide's introduction, H2/H3 hierarchy and ending next step.
  Retain safety advice that keeps visitors off roofs and preserves the existing
  assessment-first tone. On Industry Answers, group links by visible symptom and
  add concise descriptions that distinguish repair, restoration and drainage.
  Do not add external regulatory claims or instructions beyond existing,
  evidence-safe language.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `node tests/content-seo.test.mjs`

  Expected: PASS with all six guides and the Industry Answers hub linked into
  the commercial cluster.

- [ ] **Step 5: Commit the advice-content slice**

  ```bash
  git add tests/content-seo.test.mjs industry-answers.html *-guide.html
  git commit -m "feat: strengthen roofing advice content paths"
  ```

### Task 4: Differentiate canonical locality-page enquiry paths

**Files:**
- Modify: `roof-repairs-adelaide-cbd.html`
- Modify: `roof-repairs-north-adelaide.html`
- Modify: `roof-repairs-norwood-adelaide.html`
- Modify: `roof-repairs-kensington-adelaide.html`
- Modify: `roof-repairs-burnside-adelaide.html`
- Modify: `roof-repairs-unley-adelaide.html`
- Modify: `roof-repairs-goodwood-adelaide.html`
- Modify: `roof-repairs-glen-osmond-adelaide.html`
- Modify: `roof-repairs-prospect-adelaide.html`
- Modify: `roof-repairs-salisbury-adelaide.html`
- Modify: `roof-repairs-modbury-adelaide.html`
- Modify: `roof-repairs-campbelltown-adelaide.html`
- Modify: `roof-repairs-henley-beach-adelaide.html`
- Modify: `roof-repairs-glenelg-adelaide.html`
- Modify: `roof-repairs-port-adelaide.html`
- Test: `tests/content-seo.test.mjs`

**Interfaces:**
- Consumes: existing locations, canonical pages, task-2 service routes and
  task-3 guides.
- Produces: 15 canonical local pages that add useful enquiry context without
  unverified locality, case-study or service-area claims.

- [ ] **Step 1: Add failing locality assertions**

  Extend `tests/content-seo.test.mjs` with an explicit array of the 15 canonical
  locality files. For each, assert exactly one H1, current locality name,
  `on-site` assessment language, a safe ground-level enquiry phrase, one core
  service link, one guide link, Service Areas link and a visible warranty/About
  trust route. Assert no prohibited phrases such as `24 hour`, `free
  inspection`, `insurance approved`, `guaranteed to stop all leaks` or a numeric
  warranty duration appear.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node tests/content-seo.test.mjs`

  Expected: FAIL because the current locality template does not expose all
  required safe-enquiry and trust pathways.

- [ ] **Step 3: Add locality-specific useful context without new claims**

  Keep each locality's existing verified roads and visible page facts. Add a
  concise enquiry section that asks for the existing locality/road, symptom,
  roof material if known and access constraints, and directs people to the
  matching existing service/guide. Vary only the useful symptom/service context;
  do not fabricate projects, coverage promises, property facts or a local office.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `node tests/content-seo.test.mjs`

  Expected: PASS for all 15 named canonical locality pages and zero prohibited
  phrases.

- [ ] **Step 5: Commit the locality-content slice**

  ```bash
  git add tests/content-seo.test.mjs roof-repairs-*-adelaide.html
  git commit -m "feat: improve locality enquiry content"
  ```

### Task 5: Write cache record, run regression suite and serve local preview

**Files:**
- Modify: `.gitignore`
- Create: `.seo-cache/pages/homepage/content.json` (ignored)
- Test: `tests/content-seo.test.mjs`

**Interfaces:**
- Consumes: all previous content changes and the shared-cache schema.
- Produces: a local, ignored evidence summary and verified local-preview URL.

- [ ] **Step 1: Add a failing cache-ignore assertion**

  Extend `tests/content-seo.test.mjs` to assert `.gitignore` includes
  `.seo-cache/` and that the cache file contains the required `cache_type`,
  `analyzed_at`, `url`, `score`, findings, issues, recommendations and
  limitations keys.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node tests/content-seo.test.mjs`

  Expected: FAIL because the content cache path is not yet ignored/created.

- [ ] **Step 3: Create the safe local audit record**

  Add `.seo-cache/` to `.gitignore` and write the required homepage content
  summary using only observed findings: no live rankings or conversion outcomes,
  no independent verification of business facts, and no external search-volume
  data. Do not commit the cache file.

- [ ] **Step 4: Run all verification**

  Run:
  ```bash
  Get-ChildItem .\tests -File | Sort-Object Name | ForEach-Object { & node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
  npm run vercel-build
  git diff --check
  ```

  Expected: every Node test passes, the configured Vercel build exits 0 and the
  diff has no whitespace errors.

- [ ] **Step 5: Start and check the local preview**

  Run a hidden static server for `dist` on `127.0.0.1:4173`; check the home,
  five commercial pages, six guides, FAQ and Service Areas return 200. Report
  the local URL and leave the server running for user review.

- [ ] **Step 6: Commit only tracked content/test files**

  ```bash
  git add .gitignore tests/content-seo.test.mjs
  git commit -m "test: verify sitewide content SEO"
  ```
