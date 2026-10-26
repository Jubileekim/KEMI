# Local preview video fixture

`local-preview.webm` is a tiny synthetic, muted green canvas video. It contains no external or customer content. It is required to exercise native decoding, staging and public-work UI without claiming a real upload.

- Original fixture: 1,349 bytes; SHA256 `877de05099049a5e2b7fd37fedab2d1d53635152716fc7d16cfefeefa3a063d2`.
- Recreate from the repository root with the Mock dev server on 5180: `node qa/frontend-1d/create-video-fixture.cjs`.
- The generator explicitly requests VP8 canvas frames and checks metadata/data/canplay events. Encoded bytes/timestamps may differ by browser version; E2E verifies decoding behavior rather than byte equality.
- The fixture is test-only and is not copied into public assets or production bundles. Actual storage/provider playback and submitted-file retention remain unverified.
