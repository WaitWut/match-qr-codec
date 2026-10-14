/**
 * The independent check: payloads AB's own exporter produced, and the payload Eric imported into
 * Quantum on 2026-10-09, are reproduced byte for byte from a plain match request.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { decodeMatch, decodePayload, encodeMatch } from "../src/index.ts";
import { fixture, readPng } from "./helpers.ts";

const largePart1 = fixture("ab-large-export-part-1.payload.txt");
const largePart2 = fixture("ab-large-export-part-2.payload.txt");
const single = fixture("ab-single-export.payload.txt");
const importTest = fixture("import-test.payload.txt");

test("the QR images decode to the stored payload text", () => {
  assert.equal(readPng("ab-large-export-part-1.png"), largePart1);
  assert.equal(readPng("ab-large-export-part-2.png"), largePart2);
  assert.equal(readPng("import-test.png"), importTest);

  // jsQR cannot read AB's original single-code image (ZXing can). Its text is pinned instead to
  // the SHA-256 the 2026-10-09 ZXing analysis recorded in evidence-verification-current.json.
  assert.equal(readPng("ab-single-export.png"), undefined);
  assert.equal(
    createHash("sha256").update(single).digest("hex"),
    "2c92f7ff8496c9a6d02dc1bdc0c6fb8e2cdf6b985e7c28e4fb0107318a9e68eb",
  );
});

test("every observed payload decodes with the observed envelope", () => {
  for (const text of [largePart1, largePart2, single, importTest]) {
    const decoded = decodePayload(text);
    assert.ok(decoded.ok, JSON.stringify(decoded));
    assert.equal(decoded.matchesObservedEnvelope, true);
  }
});

test("the two-code export continues Sector 6 in code 2", () => {
  const part2 = decodePayload(largePart2);
  assert.ok(part2.ok);
  assert.deepEqual(part2.records, [
    { type: "sector", stage: "Sector 6", match: "Large Export Test" },
    { type: "target", index: 5, distance: 600, unknownFields: ["0", "", "0", "0"] },
  ]);

  const match = decodeMatch([largePart1, largePart2]);
  assert.ok(match.ok, JSON.stringify(match));
  assert.equal(match.request.match.name, "Large Export Test");
  assert.deepEqual(
    match.request.match.stages.map((stage) => stage.name),
    ["Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6"],
  );
  for (const stage of match.request.match.stages) {
    assert.deepEqual(
      stage.targets.map((target) => target.distance.value),
      [100, 200, 300, 400, 500, 600],
    );
  }
});

test("the two-code export is reproduced exactly, including AB's split point", () => {
  const match = decodeMatch([largePart1, largePart2]);
  assert.ok(match.ok);
  const uuids = ["32A13D34F3", "B415579EA5"];

  // Code 1 is 1921 bytes and the next target record would add 40, so any limit from 1921 to
  // 1960 splits where AB did. Outside that range the split moves.
  for (const maxPayloadBytes of [1921, 1960]) {
    const result = encodeMatch(match.request, { uuids, maxPayloadBytes });
    assert.ok(result.ok);
    assert.deepEqual(result.payloads, [
      { part: 1, text: largePart1 },
      { part: 2, text: largePart2 },
    ]);
  }
  for (const maxPayloadBytes of [1920, 1961]) {
    const result = encodeMatch(match.request, { uuids, maxPayloadBytes });
    assert.ok(result.ok);
    assert.notEqual(result.payloads[0]!.text, largePart1);
  }
});

test("the single-code PFG export and the imported test code are reproduced exactly", () => {
  for (const text of [single, importTest]) {
    const match = decodeMatch([text]);
    assert.ok(match.ok, JSON.stringify(match));
    const result = encodeMatch(match.request, { uuids: ["3FAF2AD33A"], maxPayloadBytes: 2953 });
    assert.ok(result.ok);
    assert.deepEqual(result.payloads, [{ part: 1, text }]);
  }
});

test("decodeMatch reports a missing or out-of-order code instead of guessing", () => {
  const reversed = decodeMatch([largePart2, largePart1]);
  assert.equal(reversed.ok, false);

  const missing = decodeMatch([largePart2]);
  assert.equal(missing.ok, false);
  assert.ok(!missing.ok && missing.issues.some((issue) => issue.code === "INVALID_PAYLOAD"));
});
