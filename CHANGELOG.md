# Changelog

## Unreleased

- Match Target Data 1.0, draft: `spec/match-target-data.md`, its JSON Schema and examples. A
  neutral document format for a match's stages and target distances, for AB Quantum's review.
- `validateDocument(document)` and `encodeDocument(document, options)`, the translator from a
  document into Quantum payloads. Ignores the proposed `match.id`, `match.revision` and target
  labels; rejects meters, fractional distances and unsupported names with the encoder's codes.
- `encodeMatch` and contract version 1 are unchanged.

## 0.1.0 — 2026-10-14

First build. Apache License 2.0. Supports contract version 1 (draft).

- `encodeMatch(request, options)`: validation, record-level splitting with sector continuation,
  UUID-derived masking, deterministic output.
- `decodePayload` and `decodeMatch` diagnostics.
- Options added to the handoff contract: caller-supplied `uuids` and `maxPayloadBytes`.
- Reproduces AB's single-code and two-code exports, and the code imported on 2026-10-09, byte for
  byte.
- Quantum on Android, 2026-10-14: a fresh match (Sample Cup) and a three-code match split at this
  codec's points both imported, scanned in order. iOS, reverse order and paper untested.
