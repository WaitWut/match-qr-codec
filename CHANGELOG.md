# Changelog

## 0.1.0 — 2026-10-14

First private build. Supports contract version 1 (draft).

- `encodeMatch(request, options)`: validation, record-level splitting with sector continuation,
  UUID-derived masking, deterministic output.
- `decodePayload` and `decodeMatch` diagnostics.
- Options added to the handoff contract: caller-supplied `uuids` and `maxPayloadBytes`.
- Reproduces AB's single-code and two-code exports, and the code imported on 2026-10-09, byte for
  byte.
- Not yet tested in Quantum: any code generated from a fresh request.
