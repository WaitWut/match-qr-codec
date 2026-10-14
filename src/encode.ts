import {
  SCHEMA_VERSION,
  type EncodeOptions,
  type EncodeResult,
  type Issue,
  type Payload,
} from "./contract.ts";
import { ENVELOPE_OVERHEAD_BYTES, MAX_QR_BYTES, UUID_PATTERN, buildEnvelope } from "./format.ts";
import { splitRecords } from "./split.ts";
import { validateRequest } from "./validate.ts";

function contextIssue(message: string): Issue {
  return { code: "UNSUPPORTED_ENCODING_CONTEXT", path: "", message };
}

/**
 * Encodes a complete match as one or more Quantum import payloads, in scan order.
 *
 * Returns every payload for the whole match, or a failure. Never a partial match. Deterministic:
 * the same request and options always produce the same text.
 */
export function encodeMatch(input: unknown, options: EncodeOptions): EncodeResult {
  const validation = validateRequest(input);
  const issues: Issue[] = validation.ok ? [] : [...validation.issues];

  const { maxPayloadBytes } = options;
  const minimum = ENVELOPE_OVERHEAD_BYTES + 2;
  if (
    !Number.isInteger(maxPayloadBytes) ||
    maxPayloadBytes < minimum ||
    maxPayloadBytes > MAX_QR_BYTES
  ) {
    issues.push(
      contextIssue(
        `maxPayloadBytes must be an integer from ${minimum} to ${MAX_QR_BYTES}; got ${String(maxPayloadBytes)}.`,
      ),
    );
  }
  if (!validation.ok || issues.length > 0) return { ok: false, issues };

  const split = splitRecords(validation.request.match, maxPayloadBytes);
  if (!split.ok) return split;

  const uuids: string[] = [];
  for (let part = 1; part <= split.parts.length; part++) {
    const uuid =
      typeof options.uuids === "function" ? options.uuids(part) : options.uuids[part - 1];
    if (uuid === undefined) {
      return {
        ok: false,
        issues: [
          contextIssue(
            `This match needs ${split.parts.length} codes but only ${part - 1} UUIDs were supplied.`,
          ),
        ],
      };
    }
    if (!UUID_PATTERN.test(uuid)) {
      issues.push(
        contextIssue(`UUID for part ${part} must be ten uppercase hex characters; got "${uuid}".`),
      );
    } else if (uuids.includes(uuid)) {
      issues.push(
        contextIssue(
          `UUID for part ${part} repeats an earlier part. Observed multi-code exports never share one.`,
        ),
      );
    }
    uuids.push(uuid);
  }
  if (issues.length > 0) return { ok: false, issues };

  const payloads: Payload[] = split.parts.map((records, i) => ({
    part: i + 1,
    text: buildEnvelope(uuids[i]!, records.join("")),
  }));
  return { ok: true, schemaVersion: SCHEMA_VERSION, payloads };
}
