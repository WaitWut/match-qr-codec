/**
 * Public types for contract version 1. See docs/api-contract.md and schemas/.
 *
 * The request and result shapes are language-neutral JSON. EncodeOptions is the one TypeScript
 * convenience: `uuids` may be a function instead of an array.
 */

export const SCHEMA_VERSION = "1";
export type SchemaVersion = typeof SCHEMA_VERSION;

export type DistanceUnit = "yd";

export interface Distance {
  value: number;
  unit: DistanceUnit;
}

export interface Target {
  distance: Distance;
}

export interface Stage {
  name: string;
  targets: Target[];
}

export interface Match {
  name: string;
  stages: Stage[];
}

export interface MatchRequest {
  schemaVersion: SchemaVersion;
  match: Match;
}

export interface EncodeOptions {
  /**
   * Envelope UUIDs, one per code, in part order: ten uppercase hex characters each. Supply an
   * array (extra entries are ignored) or a function of the 1-based part number. The codec never
   * generates UUIDs itself; how they are chosen is the caller's policy and is not yet established
   * as safe for any particular import behavior.
   */
  uuids: readonly string[] | ((part: number) => string);
  /**
   * Largest allowed UTF-8 length of one returned `text`, which is what the consumer encodes in
   * one QR code. Choose it from the error correction level and printed size the consumer has
   * tested. At most 2953, the byte capacity of a version 40 code at level L.
   */
  maxPayloadBytes: number;
}

export interface Payload {
  /** 1-based, consecutive. Display metadata only; it is not part of the encoded envelope. */
  part: number;
  /** The complete envelope JSON text to encode in one QR code. */
  text: string;
}

export interface EncodeSuccess {
  ok: true;
  schemaVersion: SchemaVersion;
  payloads: Payload[];
}

export type IssueCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "UNSUPPORTED_UNIT"
  | "UNSUPPORTED_DISTANCE_PRECISION"
  | "UNSUPPORTED_NAME"
  | "UNSUPPORTED_ENCODING_CONTEXT"
  | "EXPORT_CAPACITY_UNSUPPORTED"
  | "INVALID_PAYLOAD"
  | "UNSUPPORTED_PAYLOAD";

export interface Issue {
  code: IssueCode;
  /** JSON Pointer into the request (or the decoded input), or "" for the whole document. */
  path: string;
  message: string;
}

export interface Failure {
  ok: false;
  issues: Issue[];
}

export type EncodeResult = EncodeSuccess | Failure;
