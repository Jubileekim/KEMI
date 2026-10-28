# Landing page verification · 2026-10-28

final result: passed

## Current routing and header correction · 2026-10-28

- `/` now renders the existing-data landing page. `/works` renders the original work feed, and `/works/:workId` remains the detail route. `/landing` remains a compatible landing URL, including purpose filters.
- Header logo returns to `/`; the 작품 menu, landing feed links, empty saved-works/campaign links, profile next action and Mock catalog back links now point to `/works`. Query parameters are preserved on landing-to-feed links.
- Header navigation uses `align-items: center` so plain text links and the taller logout button have matching vertical centers. A pre-existing local edit for this exact alignment was preserved when switching from the merged feature branch to latest main (`eb68f33`).
- [Authenticated header after correction](qa/landing/home-header-aligned.png): captured by the regression test using a local Mock creator session, not a production login. Every header link center differs from the logout button center by at most 1 CSS px at 1920px. Both test projects run this alignment check at that wide width, matching the reported screenshot.
- New route round-trip and alignment cases each reported `ok` in desktop and mobile projects (four case-level passes). Route round-trip checks `/` → `/works` → reload → logo `/`, plus `/landing?purpose=SNS_SHORTFORM` → `/works?purpose=SNS_SHORTFORM`. Mobile routing uses the normal mobile viewport.
- Browser regression invocation used a temporary configuration selecting installed Edge in place of missing Playwright Chromium. Both broader (28 cases) and focused (4 cases) runs stalled during runner shutdown after emitting individual pass results. The focused run ultimately reported `4 passed` plus one plugin-setup teardown timeout and exited 1; it is not claimed as a successful full command. Temporary config was removed; CI's normal browser configuration is unchanged. Full CI E2E remains pending.
- Product build/typecheck/lint passed; 29 unit-test files / 251 tests passed. Browser also confirmed the public-data root landing, original `/works` feed, and return via the home logo. Public API proxy showed an intermittent network failure on refetch; it is not reported as an API stability fix.
- Existing feed-dependent Mock/production/deployment checks were updated to `/works`; root deployment/session checks continue covering the new landing. Source mockup and earlier verification records below are historical and no longer imply the root remains the feed.

## Current revision: existing public works and videos

- Both hero and grid now read the same existing public feed API. The hero uses the first three unfiltered records; filters only change the grid. Clicking a hero opens its actual work ID.
- Both sections reuse the unchanged `Thumbnail` / `AutoplayVideo` component. The checked-in existing behavior plays muted video while visible (IntersectionObserver), pauses offscreen and honors reduced motion; this revision does not introduce a separate hover implementation.
- Removed fixed hero image references from product code. Generated images are now QA-only assets under `qa/landing/assets`, outside `public`, and are not shipped with the page.
- Verified against the existing public API on 2026-10-28: feed returned 16 works; hero links were `/works/16`, `/works/15`, `/works/14`; creators came from the server (`[시연] 노을숏폼랩`). All three hero videos had readyState 4, paused=false, and progressing currentTime (observed 7.6607s / 7.013s / 6.6315s). No signed media tokens were saved in this report.
- Real SNS filter returned IDs 16, 10, 8 while hero IDs stayed 16, 15, 14. The grid displays nine records on the initial page; more links to the existing full feed.
- Current evidence: [live desktop](qa/landing/live-desktop.jpg). Layout was compared to the selected source and the earlier hero detail; only artwork/data ownership changed. The first three server works replace the fixed illustrative collage while retaining its composition. No actionable P0/P1/P2 visual drift found. The earlier mobile layout capture remains historical evidence; a requested viewport override did not change the current browser's width during this revision, so no new live-mobile capture is claimed.
- Before live verification, the revised local video fixture also rendered twelve video elements, with all three visible hero videos playing. Empty/error/retry states remain explicit, including hero fetch states.
- `qa/landing/live-vite.config.ts` is an optional read-only preview against the existing upstream. It changes upstream Host/SNI only in this QA config; product Vite/deployment configuration remains untouched. It rejects non-GET and non-public API paths. Run `npm run dev --workspace @kemi/web -- --config ../../qa/landing/live-vite.config.ts --host 127.0.0.1`.
- Final application build/typecheck/lint and all 246 existing web tests passed after the product-code change. No database or production data was changed. Preview deployment itself remains subject to Vercel CI.

## Initial implementation record (before existing-data correction)

Scope: add the selected merged KEMI landing page to the existing React + Vite app at `/landing`. Existing `/` remains the original work feed. Base: origin/main `76e2f0d`; implementation branch: `feat/landing-page`.

## Evidence and comparison

- Source visual truth: [selected merged mockup](qa/landing/reference.png), 971 × 1619 pixels, desktop concept rather than a browser capture.
- Browser implementation: [desktop](qa/landing/desktop.jpg), [hero detail](qa/landing/hero.jpg), [mobile](qa/landing/mobile.jpg), [tablet](qa/landing/tablet.jpg).
- Desktop CSS viewport: 1440 × 1000; actual full-page screenshot: 1424 × 2420 pixels. Browser UI excludes the scrollbar and screenshot density follows the host display. No stretching was applied. Compared corresponding sections at their relative page widths rather than treating source pixels as CSS dimensions.
- Responsive viewports: 390 × 844 and 768 × 1024. DOM measurements showed no horizontal overflow at all three widths.
- Full-page state: guest, all purposes, nine local fixture records. Viewed source and desktop together, then inspected the separate hero capture to check legible typography, CTA spacing, photo crops, and button details. Mobile capture was checked separately because no mobile source was supplied.
- Local dev-only toolbar accounts for additional screenshot height and is excluded from production builds.

## Required fidelity surfaces

- Typography: uses the existing Pretendard/Pretendard Variable stack, with Korean system fallback where unavailable. Desktop main headline 48px; section heading 32px; responsive main headline reduces without clipping. The source's two-line main headline and green second line are preserved.
- Layout: left introduction/right three-photo collage, category pills, three-column desktop work feed, centered more link, bottom recruitment CTA, branded footer. 24px card corners and pill buttons use canonical tokens. Mobile uses a stacked hero and one-column feed. Existing shell/nav is reused.
- Colors: canonical white, green, mint, text and border tokens. Solid pale mint CTA and a white hero intentionally simplify the generated decorative gradient/leaf artwork; no fabricated CSS illustration is substituted. This is P3 polish rather than a functional or hierarchy mismatch.
- Assets: actual supplied brand SVG reused. Three individually generated photographic hero assets are stored under `apps/web/public/landing/`. They preserve rainy cafe / sunset couple / espresso subjects. Work thumbnails and video behavior reuse the existing signed-media component. Source data and imagery remain API-owned, not copied or hardcoded from the mockup.
- Copy: introduction and CTA preserve selected concept copy. Filter uses every purpose supported by the existing API, including family and celebration, rather than hiding valid product categories. Creator names and prices are rendered from API responses without fabricated social proof.

## Interactions and states verified in the in-app browser

- Category selection updates URL and `aria-pressed`; SNS filter returned two fixture records, travel two, other one.
- Reload preserves category selection; all resets it.
- Hero category link updates the filter and scrolls to `#landing-works`.
- Empty category shows a specific empty state, not a failed-request message; reset restores all records.
- Forced HTTP 503 shows an error and retry button. Returning the fixture to healthy and clicking retry restores the list.
- More link opens the unchanged `/` work feed; its heading and original select filter render.
- Recruitment CTA opens the existing `/campaigns` screen. Recruitment data itself is outside this fixture's scope.
- Link targets for works and creators use IDs from the feed. Actual production record detail playback was not tested.
- Console checked: no JavaScript errors during successful landing render. The intentional 503 test and unsupported fixture routes produced expected network failures. Existing devtools shim warning is unrelated to the page.
- Semantic headings, image alt text, button labels, 44px or larger filter targets, token focus rings on interactive controls, and reduced-motion transition handling were reviewed. Existing video component retains reduced-motion behavior.

## Iteration history

1. Initial capture showed the header scrolled off-screen because the existing shell focuses main on route changes. Landing-only `preventScroll` fixed initial positioning. Automatic main focus also drew a page-sized outline; removed it only for the non-interactive landing main, preserving interactive focus indicators.
2. Initial full capture contained some empty media slots due to local Windows Vite proxy `ECONNRESET` responses. Kept production transport unchanged. The disposable QA fixture was accessed directly through a process-local `VITE_API_BASE_URL`; final desktop capture contains all twelve images. No retry workaround was added to product code.
3. Added the actual brand logo to the landing footer. Final desktop/hero captures show corrected positioning, all media slots, and footer branding. No actionable P0/P1/P2 findings remain within the requested page scope.

## Validation and reproduction

- `npm run build:web`: passed (typecheck, lint, production Vite build). Two existing dynamic-import warnings concern ActivityLive/SafetyLive shared imports.
- `npm run test:web`: 28 files, 246 tests passed.
- `git diff --check`: passed.
- `qa/landing/preview-api.cjs` is a disposable loopback-only visual fixture; never imported by the app or deployed. It uses explicitly labeled `[미리보기]` names and reuses the three hero photos for test thumbnails. Repeated/mismatched card subjects in QA captures are fixture data, not production content or fixed landing content.
- To reproduce locally: run `node qa/landing/preview-api.cjs`; in a second PowerShell process set `$env:VITE_API_BASE_URL='http://127.0.0.1:4000'` and run `npm run dev --workspace @kemi/web -- --host 127.0.0.1`; visit `/landing` on port 5173. Without that process-local override the app retains its existing API configuration.
- Production API/database/storage/deployment were not changed or verified. Real thumbnails, prices, and visibility depend on the existing public feed API.

## Implementation checklist

- [x] Dedicated lazy `/landing` route and scoped CSS.
- [x] Reuse brand, tokens, navigation, query client and media behavior.
- [x] Filters, links, loading/error/empty states.
- [x] Desktop/mobile/tablet browser checks and source comparison.
- [x] Build, lint, typecheck, existing tests and final diff review.

## Follow-up polish

- P3: optional art-directed decorative raster treatment matching the mockup's leaf motif, if desired.
- P3: hero PNG compression can be evaluated before a production deployment; no new image-processing dependency was added.
