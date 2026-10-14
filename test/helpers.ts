import { readFileSync, readdirSync } from "node:fs";
import jsQRModule from "jsqr";
import { PNG } from "pngjs";
import QRCode from "qrcode";
import type { MatchRequest, Payload } from "../src/index.ts";

const jsQR = jsQRModule.default;

const root = new URL("../", import.meta.url);

export function fixture(name: string): string {
  return readFileSync(new URL(`test/fixtures/${name}`, root), "utf8");
}

export interface Vector {
  description: string;
  provenance: { kind: "observed" | "derived" | "synthetic"; source: string; appImport: string };
  request: MatchRequest;
  options: { uuids: string[]; maxPayloadBytes: number };
  expected: { payloads: Payload[]; records: string[][] };
}

export function vectors(): { file: string; vector: Vector }[] {
  const dir = new URL("test/vectors/", root);
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => ({
      file,
      vector: JSON.parse(readFileSync(new URL(file, dir), "utf8")) as Vector,
    }));
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, root), "utf8"));
}

/** Decodes a QR code from a PNG file with jsQR, independent of the renderer that made it. */
export function readPng(name: string): string | undefined {
  const png = PNG.sync.read(
    readFileSync(new URL(`test/fixtures/${name}`, root)) as unknown as Buffer,
  );
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
}

export type Ecc = "L" | "M" | "Q" | "H";

/**
 * Renders text with qrcode (the renderer MatchOps uses) and reads it back with jsQR.
 * Returns undefined when the text does not fit at this error correction level.
 */
export function renderAndRead(
  text: string,
  ecc: Ecc,
): { version: number; read: string | undefined } | undefined {
  let qr: ReturnType<typeof QRCode.create>;
  try {
    qr = QRCode.create(text, { errorCorrectionLevel: ecc });
  } catch {
    return undefined;
  }
  const size = qr.modules.size;
  const scale = 4;
  const quiet = 4;
  const dim = (size + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qr.modules.data[row * size + col]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const y = (row + quiet) * scale + dy;
          const x = (col + quiet) * scale + dx;
          const i = (y * dim + x) * 4;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
        }
      }
    }
  }
  return { version: qr.version, read: jsQR(pixels, dim, dim)?.data };
}

/** Small deterministic PRNG (mulberry32) for property tests. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sequentialUuids(part: number): string {
  return part.toString(16).toUpperCase().padStart(10, "0");
}
