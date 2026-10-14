# Maintenance

## When Quantum changes

Nothing detects a Quantum update automatically. The check is manual:

- When a Quantum update is noticed, and before a consumer release that changes the codec version,
  import a known code (`sample-cup.json` once it has passed, otherwise `import-test.json`) and
  record the result in compatibility.md.
- If an AB export with a different `appVersion`, `versionType` or record shape turns up, add it to
  `test/private-fixtures/`, decode it, and record the difference in
  quantum-format-observations.md before changing the encoder.

## When something breaks

1. Confirm it with a known code and record the app version and platform.
2. Consumers turn their QR feature off through their own configuration. The codec has no switch.
3. Fix the encoder against new fixtures and tests, release, and re-run the app check.
4. Codes already printed or downloaded cannot be recalled. Regenerate only after the fixed code has
   passed in the app.

## Releases

- Tag each release `vX.Y.Z` and list in CHANGELOG.md the contract versions it supports and any
  encoding change.
- A change that rejects a previously accepted request, or changes result semantics, needs a new
  contract version.
- No support response time or ongoing compatibility is promised to anyone, including future
  outside users if the code is ever published.

## Publication

The repository is private. Publishing it needs, in order: AB's agreement; a license decision
(Apache 2.0 is proposed, not adopted); and a clean export containing no fixtures, screenshots,
correspondence or history from this private experiment. Public test vectors need metadata we
can explain on its own, not AB's UUIDs.
