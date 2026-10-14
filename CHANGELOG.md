# Changelog

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
