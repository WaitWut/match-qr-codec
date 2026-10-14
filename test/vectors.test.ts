/**
 * Portable test vectors (test/vectors/*.json): request + options -> exact payloads -> records.
 * Each vector also renders through qrcode at every error correction level that fits and reads
 * back through jsQR, to show the text survives a real QR round trip. That is not Quantum
 * acceptance; see docs/compatibility.md.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeMatch, decodePayload, encodeMatch } from "../src/index.ts";
import { renderAndRead, vectors, type Ecc } from "./helpers.ts";

const all = vectors();

test("there are vectors of every provenance", () => {
  const kinds = new Set(all.map(({ vector }) => vector.provenance.kind));
  assert.deepEqual([...kinds].sort(), ["derived", "observed", "synthetic"]);
});

for (const { file, vector } of all) {
  test(`vector ${file}`, () => {
    const result = encodeMatch(vector.request, vector.options);
    assert.ok(result.ok, JSON.stringify(!result.ok && result.issues));
    assert.deepEqual(result.payloads, vector.expected.payloads);

    const records = result.payloads.map((payload) => {
      const decoded = decodePayload(payload.text);
      assert.ok(decoded.ok);
      return decoded.stream
        .slice(0, -1)
        .split("%")
        .map((record) => `${record}%`);
    });
    assert.deepEqual(records, vector.expected.records);

    const roundTrip = decodeMatch(result.payloads.map((payload) => payload.text));
    assert.ok(roundTrip.ok);
    assert.deepEqual(roundTrip.request, vector.request);
  });

  test(`vector ${file} survives a QR render and readback`, () => {
    for (const payload of vector.expected.payloads) {
      let fitted = 0;
      for (const ecc of ["L", "M", "Q", "H"] satisfies Ecc[]) {
        const rendered = renderAndRead(payload.text, ecc);
        if (rendered === undefined) continue;
        fitted++;
        assert.equal(rendered.read, payload.text, `part ${payload.part} at ${ecc}`);
      }
      assert.ok(fitted > 0, `part ${payload.part} fits no error correction level`);
    }
  });
}
