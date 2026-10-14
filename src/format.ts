/**
 * The Quantum grouped-import format as observed in three AB-exported codes (app version 792).
 * Nothing here is an AB-published specification. See docs/quantum-format-observations.md.
 */

/** Envelope fields that were identical in every observed export. */
export const OBSERVED_ENVELOPE = {
  appName: "Quantum",
  appVersion: "792",
  dataType: 1,
  rawValue: "",
  versionType: 0,
} as const;

/** Observed: the five-byte data mask equals the UUID's bytes XOR this constant. */
const MASK_KEY = [0xd9, 0xca, 0x21, 0xf3, 0x49] as const;

export const UUID_PATTERN = /^[0-9A-F]{10}$/;

/** Byte capacity of a version 40 QR code at error correction L. */
export const MAX_QR_BYTES = 2953;

const encoder = new TextEncoder();

export function utf8Length(text: string): number {
  return encoder.encode(text).length;
}

export function sectorRecord(stageName: string, matchName: string): string {
  return `:QR,TS,${stageName},${matchName}%`;
}

/** Fields 3, 4, 6 and 7 are unidentified; every observed export carried 0, "", 0, 0. */
export function targetRecord(index: number, distance: number): string {
  return `:QR,TD,${index},0,,${distance},0,0%`;
}

function maskFor(uuid: string): number[] {
  return MASK_KEY.map((key, i) => parseInt(uuid.slice(i * 2, i * 2 + 2), 16) ^ key);
}

function applyMask(bytes: Uint8Array, mask: readonly number[]): Uint8Array {
  return bytes.map((byte, i) => byte ^ mask[i % mask.length]!);
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Builds one complete envelope. Key order and compact JSON match the observed exports. */
export function buildEnvelope(uuid: string, stream: string): string {
  const data = toHex(applyMask(encoder.encode(stream), maskFor(uuid)));
  return JSON.stringify({
    appName: OBSERVED_ENVELOPE.appName,
    appVersion: OBSERVED_ENVELOPE.appVersion,
    data,
    dataType: OBSERVED_ENVELOPE.dataType,
    rawValue: OBSERVED_ENVELOPE.rawValue,
    uuid,
    versionType: OBSERVED_ENVELOPE.versionType,
  });
}

/** Envelope length when `data` is empty. Every stream byte then adds two hex characters. */
export const ENVELOPE_OVERHEAD_BYTES = utf8Length(buildEnvelope("0000000000", ""));

/** Unmasks a data field. Throws on invalid hex or UTF-8; callers validate first. */
export function unmaskData(uuid: string, data: string): string {
  const bytes = applyMask(fromHex(data), maskFor(uuid.toUpperCase()));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
