import { SCHEMA_VERSION, type Issue, type MatchRequest, type Stage } from "./contract.ts";
import { OBSERVED_ENVELOPE, unmaskData } from "./format.ts";
import { pointer } from "./pointer.ts";

export interface SectorRecord {
  type: "sector";
  stage: string;
  match: string;
}

export interface TargetRecord {
  type: "target";
  index: number;
  distance: number;
  /** Zero-based record fields 3, 4, 6 and 7, whose meaning is unidentified. */
  unknownFields: [string, string, string, string];
}

export type QuantumRecord = SectorRecord | TargetRecord;

export interface Envelope {
  appName: string;
  appVersion: string;
  dataType: number;
  rawValue: string;
  uuid: string;
  versionType: number;
}

export interface DecodedPayload {
  ok: true;
  envelope: Envelope;
  /** True when every envelope field other than uuid and data equals the observed exports. */
  matchesObservedEnvelope: boolean;
  /** The unmasked record stream. */
  stream: string;
  records: QuantumRecord[];
}

export type DecodePayloadResult = DecodedPayload | { ok: false; issues: Issue[] };

const OBSERVED_UNKNOWN_FIELDS = ["0", "", "0", "0"];

function fail(code: Issue["code"], path: string, message: string): { ok: false; issues: Issue[] } {
  return { ok: false, issues: [{ code, path, message }] };
}

/**
 * Diagnostic: decodes one payload's text into its envelope and records. Issue paths point into
 * the envelope (`/data`) or the record list (`/records/<n>`).
 */
export function decodePayload(text: string): DecodePayloadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail("INVALID_PAYLOAD", "", "Payload is not JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return fail("INVALID_PAYLOAD", "", "Payload is not a JSON object.");
  }
  const raw = parsed as Record<string, unknown>;

  const expected = {
    appName: "string",
    appVersion: "string",
    data: "string",
    dataType: "number",
    rawValue: "string",
    uuid: "string",
    versionType: "number",
  } as const;
  const issues: Issue[] = [];
  for (const [key, type] of Object.entries(expected)) {
    if (typeof raw[key] !== type) {
      issues.push({ code: "INVALID_PAYLOAD", path: pointer(key), message: `Expected a ${type}.` });
    }
  }
  for (const key of Object.keys(raw)) {
    if (!(key in expected)) {
      issues.push({
        code: "UNSUPPORTED_PAYLOAD",
        path: pointer(key),
        message: "Envelope field not seen in any observed export.",
      });
    }
  }
  if (issues.length > 0) return { ok: false, issues };

  const envelope: Envelope = {
    appName: raw.appName as string,
    appVersion: raw.appVersion as string,
    dataType: raw.dataType as number,
    rawValue: raw.rawValue as string,
    uuid: raw.uuid as string,
    versionType: raw.versionType as number,
  };
  const data = raw.data as string;
  if (!/^[0-9A-Fa-f]{10}$/.test(envelope.uuid)) {
    return fail("INVALID_PAYLOAD", "/uuid", "uuid is not ten hex characters.");
  }
  if (data.length === 0 || data.length % 2 !== 0 || !/^[0-9A-Fa-f]+$/.test(data)) {
    return fail("INVALID_PAYLOAD", "/data", "data is not a nonempty even-length hex string.");
  }

  let stream: string;
  try {
    stream = unmaskData(envelope.uuid, data);
  } catch {
    return fail("INVALID_PAYLOAD", "/data", "Unmasked data is not valid UTF-8.");
  }
  if (!stream.endsWith("%")) {
    return fail("INVALID_PAYLOAD", "/data", "Record stream does not end with a % terminator.");
  }

  const records: QuantumRecord[] = [];
  const texts = stream.slice(0, -1).split("%");
  for (const [n, recordText] of texts.entries()) {
    const path = pointer("records", n);
    const fields = recordText.split(",");
    if (fields[0] !== ":QR") {
      return fail("INVALID_PAYLOAD", path, `Record does not start with ":QR": "${recordText}".`);
    }
    if (fields[1] === "TS") {
      if (fields.length !== 4) {
        return fail("INVALID_PAYLOAD", path, `Sector record has ${fields.length} fields, not 4.`);
      }
      records.push({ type: "sector", stage: fields[2]!, match: fields[3]! });
    } else if (fields[1] === "TD") {
      if (fields.length !== 8) {
        return fail("INVALID_PAYLOAD", path, `Target record has ${fields.length} fields, not 8.`);
      }
      const [, , index, f3, f4, distance, f6, f7] = fields as [string, ...string[]];
      if (!/^\d+$/.test(index!) || !/^\d+(\.\d+)?$/.test(distance!)) {
        return fail("INVALID_PAYLOAD", path, `Target index or distance is not numeric.`);
      }
      if (records.length === 0) {
        return fail("INVALID_PAYLOAD", path, "Target record before any sector record.");
      }
      records.push({
        type: "target",
        index: Number(index),
        distance: Number(distance),
        unknownFields: [f3!, f4!, f6!, f7!],
      });
    } else {
      return fail("UNSUPPORTED_PAYLOAD", path, `Unrecognized record type "${fields[1]}".`);
    }
  }

  const matchesObservedEnvelope =
    envelope.appName === OBSERVED_ENVELOPE.appName &&
    envelope.appVersion === OBSERVED_ENVELOPE.appVersion &&
    envelope.dataType === OBSERVED_ENVELOPE.dataType &&
    envelope.rawValue === OBSERVED_ENVELOPE.rawValue &&
    envelope.versionType === OBSERVED_ENVELOPE.versionType;

  return { ok: true, envelope, matchesObservedEnvelope, stream, records };
}

export type DecodeMatchResult =
  { ok: true; request: MatchRequest } | { ok: false; issues: Issue[] };

/**
 * Diagnostic: reassembles a match request from payloads in scan order, the inverse of
 * encodeMatch. Distances come back in "yd" because that is what encodeMatch accepts; the payload
 * itself carries no unit. Fails rather than dropping anything it cannot represent: unknown
 * target attributes, gaps in target indices, inconsistent group names, empty sectors.
 * Issue paths are `/<payload index>/...`.
 */
export function decodeMatch(texts: readonly string[]): DecodeMatchResult {
  if (texts.length === 0) return fail("INVALID_INPUT", "", "No payloads supplied.");

  const stages: Stage[] = [];
  let matchName: string | undefined;
  const issues: Issue[] = [];

  for (const [p, text] of texts.entries()) {
    const decoded = decodePayload(text);
    if (!decoded.ok) {
      for (const issue of decoded.issues) issues.push({ ...issue, path: pointer(p) + issue.path });
      continue;
    }
    for (const [n, record] of decoded.records.entries()) {
      const path = pointer(p, "records", n);
      if (record.type === "sector") {
        if (matchName === undefined) matchName = record.match;
        else if (record.match !== matchName) {
          issues.push({
            code: "UNSUPPORTED_PAYLOAD",
            path,
            message: `Group name "${record.match}" differs from "${matchName}".`,
          });
        }
        const last = stages.at(-1);
        const next = decoded.records[n + 1];
        const continues =
          n === 0 &&
          last !== undefined &&
          last.name === record.stage &&
          next?.type === "target" &&
          next.index === last.targets.length;
        if (continues) continue;

        if (last !== undefined && last.targets.length === 0) {
          issues.push({
            code: "UNSUPPORTED_PAYLOAD",
            path,
            message: `Sector "${last.name}" has no targets.`,
          });
        }
        if (stages.some((stage) => stage.name === record.stage)) {
          issues.push({
            code: "UNSUPPORTED_PAYLOAD",
            path,
            message: `Sector "${record.stage}" appears twice and is not a continuation.`,
          });
        }
        stages.push({ name: record.stage, targets: [] });
      } else {
        const stage = stages.at(-1)!;
        if (record.index !== stage.targets.length) {
          issues.push({
            code: "INVALID_PAYLOAD",
            path,
            message: `Sector "${stage.name}" expects target index ${stage.targets.length}, found ${record.index}. A code may be missing or out of order.`,
          });
        }
        if (record.unknownFields.some((field, i) => field !== OBSERVED_UNKNOWN_FIELDS[i])) {
          issues.push({
            code: "UNSUPPORTED_PAYLOAD",
            path,
            message: `Target carries unidentified attribute values (${record.unknownFields.join(", ")}) a match request cannot represent.`,
          });
        }
        stage.targets.push({ distance: { value: record.distance, unit: "yd" } });
      }
    }
  }

  const last = stages.at(-1);
  if (last !== undefined && last.targets.length === 0) {
    issues.push({
      code: "UNSUPPORTED_PAYLOAD",
      path: "",
      message: `Sector "${last.name}" has no targets.`,
    });
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    request: { schemaVersion: SCHEMA_VERSION, match: { name: matchName!, stages } },
  };
}
