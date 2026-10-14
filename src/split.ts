import type { Issue, Match } from "./contract.ts";
import { ENVELOPE_OVERHEAD_BYTES, sectorRecord, targetRecord, utf8Length } from "./format.ts";
import { pointer } from "./pointer.ts";

export type SplitResult = { ok: true; parts: string[][] } | { ok: false; issues: Issue[] };

/**
 * Groups a match's records into parts whose envelopes fit `maxPayloadBytes`.
 *
 * Splits only between whole records, as the observed AB exporter does. A part that continues a
 * stage repeats that stage's sector record and keeps counting target indices from where the
 * previous part stopped. A sector record is never left at the end of a part without a target.
 * With the AB pair's own limit this reproduces AB's split exactly; whether Quantum accepts
 * splits at other points is untested.
 */
export function splitRecords(match: Match, maxPayloadBytes: number): SplitResult {
  const streamLimit = Math.floor((maxPayloadBytes - ENVELOPE_OVERHEAD_BYTES) / 2);
  const parts: string[][] = [];
  let current: string[] = [];
  let currentBytes = 0;

  for (const [s, stage] of match.stages.entries()) {
    const header = sectorRecord(stage.name, match.name);
    const headerBytes = utf8Length(header);
    let headerInCurrent = false;

    for (const [t, target] of stage.targets.entries()) {
      const record = targetRecord(t, target.distance.value);
      const recordBytes = utf8Length(record);

      if (currentBytes + recordBytes + (headerInCurrent ? 0 : headerBytes) > streamLimit) {
        if (current.length > 0) {
          parts.push(current);
          current = [];
          currentBytes = 0;
          headerInCurrent = false;
        }
        if (headerBytes + recordBytes > streamLimit) {
          return {
            ok: false,
            issues: [
              {
                code: "EXPORT_CAPACITY_UNSUPPORTED",
                path: pointer("match", "stages", s, "targets", t),
                message: `One sector record and one target need a ${ENVELOPE_OVERHEAD_BYTES + 2 * (headerBytes + recordBytes)}-byte payload, more than maxPayloadBytes ${maxPayloadBytes}.`,
              },
            ],
          };
        }
      }

      if (!headerInCurrent) {
        current.push(header);
        currentBytes += headerBytes;
        headerInCurrent = true;
      }
      current.push(record);
      currentBytes += recordBytes;
    }
  }

  if (current.length > 0) parts.push(current);
  return { ok: true, parts };
}
