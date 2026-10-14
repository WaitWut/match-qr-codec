/**
 * Property test over generated matches and limits: every payload fits, nothing is dropped,
 * continued stages keep their target indices, and the output is deterministic.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ENVELOPE_OVERHEAD_BYTES,
  MAX_QR_BYTES,
  decodeMatch,
  decodePayload,
  encodeMatch,
  type MatchRequest,
} from "../src/index.ts";
import { prng, sequentialUuids } from "./helpers.ts";

const NAME_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -_.()/&#'";

function generate(random: () => number): MatchRequest {
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const name = (prefix: string) => {
    let text = prefix;
    for (let i = int(0, 24); i > 0; i--) text += NAME_CHARS[int(0, NAME_CHARS.length - 1)];
    return text;
  };
  return {
    schemaVersion: "1",
    match: {
      name: name("M"),
      stages: Array.from({ length: int(1, 12) }, (_, s) => ({
        name: name(`S${s + 1}|`),
        targets: Array.from({ length: int(1, 12) }, () => ({
          distance: { value: int(1, 1500), unit: "yd" as const },
        })),
      })),
    },
  };
}

test("generated matches split correctly at generated limits", () => {
  const random = prng(20261014);
  let multiPart = 0;
  let capacityFailures = 0;

  for (let run = 0; run < 400; run++) {
    const request = generate(random);
    const maxPayloadBytes =
      ENVELOPE_OVERHEAD_BYTES +
      2 +
      Math.floor(random() * (MAX_QR_BYTES - ENVELOPE_OVERHEAD_BYTES - 1));
    const options = { uuids: sequentialUuids, maxPayloadBytes };
    const result = encodeMatch(request, options);

    if (!result.ok) {
      assert.deepEqual(
        result.issues.map((issue) => issue.code),
        ["EXPORT_CAPACITY_UNSUPPORTED"],
      );
      capacityFailures++;
      continue;
    }

    assert.deepEqual(encodeMatch(request, options), result, "not deterministic");
    assert.deepEqual(
      result.payloads.map((payload) => payload.part),
      result.payloads.map((_, i) => i + 1),
    );
    if (result.payloads.length > 1) multiPart++;

    for (const payload of result.payloads) {
      assert.ok(new TextEncoder().encode(payload.text).length <= maxPayloadBytes);
      const decoded = decodePayload(payload.text);
      assert.ok(decoded.ok);
      assert.equal(decoded.records[0]?.type, "sector", "a part must open with a sector record");
      decoded.records.forEach((record, i) => {
        if (record.type === "sector") {
          assert.equal(decoded.records[i + 1]?.type, "target", "sector record without a target");
        }
      });
    }

    const roundTrip = decodeMatch(result.payloads.map((payload) => payload.text));
    assert.ok(roundTrip.ok, JSON.stringify(!roundTrip.ok && roundTrip.issues));
    assert.deepEqual(roundTrip.request, request);
  }

  // The generator must actually exercise splitting and the capacity failure.
  assert.ok(multiPart > 50, `only ${multiPart} multi-part runs`);
  assert.ok(capacityFailures > 0, "no capacity failures generated");
});
