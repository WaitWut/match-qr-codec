/**
 * Writes the QR images for the manual Quantum app tests in docs/compatibility.md to app-tests/.
 * AB's own two codes are copied unchanged; the others are rendered from the test vectors with
 * qrcode at error correction L (what AB's exporter uses), a four-module margin, 1000 px.
 * Run: node --experimental-strip-types scripts/render-app-test-codes.ts
 */
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import QRCode from "qrcode";

const root = new URL("../", import.meta.url);
const out = new URL("app-tests/", root);
mkdirSync(out, { recursive: true });

copyFileSync(
  new URL("test/fixtures/ab-large-export-part-1.png", root),
  new URL("1-ab-large-export-code-1-of-2.png", out),
);
copyFileSync(
  new URL("test/fixtures/ab-large-export-part-2.png", root),
  new URL("1-ab-large-export-code-2-of-2.png", out),
);

for (const [prefix, file] of [
  ["2-sample-cup", "sample-cup.json"],
  ["3-eight-stage", "eight-stage-capacity.json"],
] as const) {
  const vector = JSON.parse(readFileSync(new URL(`test/vectors/${file}`, root), "utf8"));
  const payloads: { part: number; text: string }[] = vector.expected.payloads;
  for (const { part, text } of payloads) {
    const name = `${prefix}-code-${part}-of-${payloads.length}.png`;
    await QRCode.toFile(new URL(name, out).pathname.replace(/^\/([A-Za-z]:)/, "$1"), text, {
      errorCorrectionLevel: "L",
      margin: 4,
      width: 1000,
    });
    console.log(name);
  }
}
