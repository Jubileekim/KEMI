# DEV catalog media

`catalog-sample.webm` is a copy of repository-owned synthetic QA video `e2e/fixtures/kemi-review.webm`. No customer content or external provider is used. All five synthetic sample entries deliberately reuse this labeled test clip; their titles/styles are discovery fixtures, not real portfolio claims.

`catalog-poster.png` is its first decoded frame, captured with `node qa/frontend-6/capture.mjs` against the task Mock server on5196. The script also checks390/1280px overflow and captures the feed. These media are imported only within the DEV lazy catalog graph. Production bundle exclusion is checked separately.
