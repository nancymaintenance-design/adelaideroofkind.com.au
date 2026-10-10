# Sitewide content SEO design

## Goal

Improve search-intent fit, heading hierarchy, evidence-led E-E-A-T, FAQs,
internal links and enquiry guidance across the existing indexable website while
preserving Ellis Services Group's plain, practical brand voice. The work stays
local until the user reviews the preview and separately authorises a deploy.

## Evidence and content boundaries

- The supplied keyword map is an intent and prioritisation input, not a source
  of search volume, business capability or service-area claims.
- Existing evidence that can be referenced includes the ABR link on
  `about.html`, published project photographs on the five core service pages,
  Adelaide address/contact details, on-site assessment and written-quote
  process, and the existing written-warranty statement.
- Do not invent licence classes, insurance, customer counts, review scores,
  warranty durations, prices, response times, emergency availability, case
  results, service coverage, materials or qualifications.
- Keep repair, gutter cleaning and roof cleaning distinct. Do not introduce
  roof-cleaning services because a keyword map proposes them; this site has an
  existing gutter-cleaning service only.
- Preserve the existing canonical URLs. Do not create the proposed 22 owner
  URLs or expand the locality set.

## Scope

The implementation covers the 33 canonical sitemap pages:

1. Homepage, About, Services, Service Areas, Contact and FAQ.
2. The five existing commercial service pages: roof repairs, roof leaks, roof
   restoration, gutter/downpipe repairs and gutter cleaning.
3. The six advice guides and the Industry Answers hub.
4. The 15 existing canonical locality pages.

Duplicate, non-sitemap locality files remain outside this content pass because
their canonicalisation is a separate technical migration decision.

## Content architecture

### Commercial intent pages

Each service page leads with the job to be solved, clarifies the inspection or
cleaning boundary, describes the information that helps scope an enquiry and
links to the most relevant guide and adjacent service. A concise trust path
links to About for the ABR record, project photographs already on the page and
the written warranty/process statement. Service-page FAQs answer only questions
that match the visible scope; their schema text must match the visible answer.

Keyword-map P1 themes map to existing pages as follows:

| Intent cluster | Existing destination |
| --- | --- |
| Roof repair, tiles, ridge capping, flashing and valleys | `roof-repairs-adelaide.html` |
| Leak tracing and storm-related water entry | `roof-leak-repairs-adelaide.html` |
| Gutter joints, outlets and downpipes | `gutter-downpipe-repairs-adelaide.html` |
| Gutter debris and accessible flow checks | `gutter-cleaning-adelaide.html` |
| Repair-first restoration decisions | `roof-restoration-adelaide.html` |

### Informational pages

Each guide uses an answer-first introduction, clear H2/H3 progression, a
ground-level/safety boundary where relevant, and descriptive links to the
commercial page that fulfils the next step. Industry Answers becomes the
cluster hub, directing people by problem rather than repeating service copy.

### Locality pages

Locality pages keep only verified existing local references and use a consistent
but varied enquiry pathway: property type or access context where already
published, the relevant visible symptom, then suburb/road/access details for an
on-site assessment. They retain links to nearby localities, their relevant core
service and a relevant guide. No new claims of presence, travel coverage or
local projects are added.

### Conversion and trust path

Every indexable page provides a clear, non-urgent route to call, email or use
the form. Enquiry prompts request suburb, issue, materials if known, safe
ground-level observations, access constraints, solar/rainwater context where
relevant, and never request that a visitor climbs onto the roof. About remains
the evidence source for ABR and business process; the FAQ explains that written
warranty information specifies applicable coverage, duration and exclusions.

## Structure and technical content rules

- Preserve one H1 per page and use H2 sections for major user intents; H3 is
  used only beneath its relevant H2.
- Keep titles, H1s, meta descriptions, visible copy and existing structured
  data aligned. FAQ schema must not contain an answer that differs from the
  visible answer.
- Prefer descriptive anchor text; avoid generic repeated "Read more" links.
- Retain original-project captions and photo alt text. Do not portray stock or
  concept imagery as project evidence.
- Do not alter redirects, canonical URLs, sitemap population, forms, APIs,
  analytics, Vercel configuration or deployment settings in this content pass.

## Verification

Automated checks will cover the following:

1. Each targeted canonical page has exactly one H1 and a non-empty title and
   meta description.
2. Every commercial page contains a scope boundary, a conversion route and
   descriptive links to its related guide/service path.
3. Visible FAQ question-and-answer pairs match their FAQPage schema pairs.
4. All 15 canonical locality pages retain their place, on-site assessment and
   safe-enquiry signals without forbidden broad service claims.
5. The ABR trust route, existing project-evidence labels and written-warranty
   wording remain discoverable from the content architecture.
6. Existing test suite, Vercel build command, static local preview and HTTP
   checks pass.

## Delivery

Implementation will be test-first, use the existing static HTML patterns, add a
content-audit cache record outside version control, and start a local preview on
`127.0.0.1` after verification. No GitHub push or Vercel deployment is part of
this delivery.
