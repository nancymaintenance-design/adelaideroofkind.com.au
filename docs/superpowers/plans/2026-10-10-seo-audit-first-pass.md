# SEO audit first-pass implementation plan

## Context

Implement the safe, verifiable first-pass actions from the 2026-10-10 public SEO audit using GitHub commit `02e3f154` as the baseline. This is a static Vercel site. Local preview is required; deployment, push, merge, and any Vercel mutation are explicitly out of scope.

## Global constraints

- Preserve the public claims already present; do not invent staff, qualifications, insurance, warranties, reviews, ratings, project dates, or service coverage.
- Treat the 15 suburb pages as a future evidence-led consolidation project: do not mass-create or expand them in this pass.
- Keep the existing contact forms and Vercel API contract working.
- Use TDD for every new or changed automated behavior check; record RED and GREEN evidence in each task report.
- Use relative site links compatible with the existing static deployment.
- Do not deploy, push, merge, or alter Vercel configuration outside the explicitly scoped redirect/header changes.

## Task 1 — Technical canonicalisation and structured-data repair

Files: `vercel.json`, `index.html`, `services.html`, `service-areas.html`, `tests/seo-foundation.test.mjs`.

1. Add a permanent `/index.html` → `/` redirect without changing the existing legacy suburb redirects.
2. Change homepage navigation/brand home links from `index.html` to `/`.
3. Correct the homepage WebPage structured-data name to `Roof Repairs Adelaide | Ellis Services Group`, retaining the existing ProfessionalService data.
4. Add valid BreadcrumbList JSON-LD to Services and Service Areas; use the canonical URL for each item and do not claim unsupported business facts.
5. Create a behavior-focused Node test that reads the deployed static/config artifacts and verifies the redirect, canonical home links, corrected WebPage name, and the two hub breadcrumb item URLs. Run it first and record its expected failure before implementation.

Acceptance: the new test and existing relevant tests pass from the repository root; no existing redirect is removed.

## Task 2 — Hub-page content and discovery paths

Files: `services.html`, `service-areas.html`, `faq.html`, `tests/seo-hubs.test.mjs`.

1. Enrich Services with clear H2 sections for leak investigation, tile/ridge/flashing repairs, restoration, and drainage/cleaning; each section must link to its existing corresponding service page with descriptive anchor text.
2. Enrich Service Areas with region-grouped navigation (Central, North/North-East, Inner East, Inner South, West/Coastal) plus an accurate explanatory paragraph and descriptive links to existing locality pages. Do not create new locality pages or make unverified local claims.
3. Group the existing FAQ page using H2 headings for leaks, roof components, drainage, and process/quotes. Retain the existing FAQPage schema questions and answers.
4. Add behavior-focused tests that parse the hub files and verify each required group has at least one matching in-site destination and that FAQPage schema remains present. Write tests first and record RED/GREEN evidence.

Acceptance: new hub test, Task 1 test, and all pre-existing tests pass from repository root, except any baseline failure documented in the ledger and separately repaired only when the root cause is confirmed.

## Task 3 — AI-readable site manifest and release safety

Files: `llms.txt`, `robots.txt`, `sitemap.xml`, `tests/seo-discovery.test.mjs`.

1. Add a concise `llms.txt` that identifies Ellis Services Group, lists only verified public contact details and canonical core service/guide URLs, and includes an update date. Do not represent it as crawler authorisation.
2. Add the new file to `robots.txt` as a discoverable resource only if the existing syntax supports it; preserve sitemap declaration and open crawl policy.
3. Update sitemap `lastmod` only for files materially changed in Tasks 1–3; include accurate date `2026-10-10` for those files and do not churn untouched locality URLs.
4. Add a test that validates llms URLs resolve to files in this repository and that robots retains sitemap/crawl directives. Write the test first and record RED/GREEN evidence.

Acceptance: test suite is green, sitemap remains well-formed XML, and no deployment/push is performed.
