# Guidance for agents

Read this before changing anything here.

## What this repository is

Two things, both deliberately independent of MatchOps or any other application:

- **Match Target Data** (`spec/`), a neutral document format for a match's stages and target
  distances. Producers write it; consumers read it directly or through a translator. Draft, written
  for AB Quantum's review. Added by Eric Wilson, 2026-10-24.
- **A codec** (`src/`): AB Quantum grouped-import QR payload strings from a match, and back.
  `encodeDocument` translates a Match Target Data document; `encodeMatch` takes the encoder's own
  request. Decided by Eric Wilson, 2026-10-14.

Rules:

- No application concepts in the codec: no club, account, match id, permission, feature flag,
  image rendering or UI. Those belong to the consumer. The spec's optional `match.id` and
  `match.revision` are proposed for consumers that recognise updates (Eric, 2026-10-24); the
  Quantum translator ignores them.
- No runtime dependencies, no network, no server. It must run in a browser.
- `spec/match-target-data.md` specifies the document; `docs/api-contract.md` specifies the encoder.
  Code, schemas, examples and docs change together.

## The format is observed, not specified

Everything about Quantum's format comes from codes AB's app exported. Never invent a field value,
escaping rule, limit, compression, part numbering or identity rule. If a change needs something
the observations do not show, stop and say so. When new evidence arrives, add the fixture to
`test/fixtures/`, record it in `docs/quantum-format-observations.md` with its source and
date, then change the encoder.

Keep observed and confirmed apart: nothing is "confirmed" until AB says so in writing or an app
import shows it, and `docs/compatibility.md` records which.

## Tests

- `npm run verify` must pass: Prettier, type check, build, tests. Prettier is the formatter.
- The observed-export tests are the independent check. Their expected payloads come from AB's
  files, never from the encoder. Do not regenerate them from encoder output to make a test pass.
- Synthetic vectors are regression locks; changing one needs a reason in the commit message.
- `test/fixtures/` holds AB-exported evidence, published with AB's agreement. Never modify those
  files; add new ones beside them.

## Not decided here

The UUID policy, the default code size, publishing to a package registry, and anything to do with
AB's permission or terms. Ask Eric.

The repository is public and Apache-2.0 licensed. Do not add anything that should not be public:
correspondence, credentials, or another party's data without their agreement.
