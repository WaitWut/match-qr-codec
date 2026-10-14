import { SCHEMA_VERSION, type Issue, type MatchRequest } from "./contract.ts";
import { pointer } from "./pointer.ts";

export type ValidationResult = { ok: true; request: MatchRequest } | { ok: false; issues: Issue[] };

type Path = (string | number)[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Printable ASCII only, until escaping and Unicode handling are established by app tests. */
const SUPPORTED_NAME = /^[\x20-\x7e]+$/;

/**
 * Validates a request against contract version 1: structure (as in the JSON Schema) plus the
 * semantic restrictions of the current experimental encoding. Collects every issue rather than
 * stopping at the first.
 */
export function validateRequest(input: unknown): ValidationResult {
  const issues: Issue[] = [];
  const add = (code: Issue["code"], path: Path, message: string) =>
    issues.push({ code, path: pointer(...path), message });

  const object = (value: unknown, path: Path, allowed: readonly string[]): boolean => {
    if (!isPlainObject(value)) {
      add("INVALID_INPUT", path, "Expected an object.");
      return false;
    }
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) add("INVALID_INPUT", [...path, key], "Unknown property.");
    }
    for (const key of allowed) {
      if (!(key in value)) add("INVALID_INPUT", [...path, key], "Required property is missing.");
    }
    return true;
  };

  const name = (value: unknown, path: Path, label: string) => {
    if (typeof value !== "string" || value.length === 0) {
      add("INVALID_INPUT", path, `${label} must be a nonempty string.`);
    } else if (value.trim().length === 0) {
      add("INVALID_INPUT", path, `${label} must not be whitespace only.`);
    } else if (/[,%\r\n]/.test(value)) {
      add(
        "UNSUPPORTED_NAME",
        path,
        `${label} contains a comma, percent sign or line break. These delimit records and no escaping is known.`,
      );
    } else if (!SUPPORTED_NAME.test(value)) {
      add(
        "UNSUPPORTED_NAME",
        path,
        `${label} contains characters outside printable ASCII, which have not been tested in Quantum.`,
      );
    }
  };

  if (!object(input, [], ["schemaVersion", "match"])) return { ok: false, issues };
  const root = input as Record<string, unknown>;

  if ("schemaVersion" in root) {
    if (typeof root.schemaVersion !== "string") {
      add("INVALID_INPUT", ["schemaVersion"], "schemaVersion must be a string.");
    } else if (root.schemaVersion !== SCHEMA_VERSION) {
      add(
        "UNSUPPORTED_SCHEMA_VERSION",
        ["schemaVersion"],
        `Only schemaVersion "${SCHEMA_VERSION}" is supported.`,
      );
    }
  }

  if ("match" in root && object(root.match, ["match"], ["name", "stages"])) {
    const match = root.match as Record<string, unknown>;
    if ("name" in match) name(match.name, ["match", "name"], "Match name");

    if ("stages" in match) {
      const stages = match.stages;
      if (!Array.isArray(stages) || stages.length === 0) {
        add("INVALID_INPUT", ["match", "stages"], "stages must be a nonempty array.");
      } else {
        const seen = new Map<string, number>();
        stages.forEach((stage: unknown, s) => {
          const stagePath = ["match", "stages", s];
          if (!object(stage, stagePath, ["name", "targets"])) return;
          const stageObject = stage as Record<string, unknown>;

          if ("name" in stageObject) {
            name(stageObject.name, [...stagePath, "name"], "Stage name");
            if (typeof stageObject.name === "string") {
              const first = seen.get(stageObject.name);
              if (first === undefined) seen.set(stageObject.name, s);
              else
                add(
                  "UNSUPPORTED_NAME",
                  [...stagePath, "name"],
                  `Stage name repeats stage ${first + 1}. How Quantum treats duplicate sector names is untested.`,
                );
            }
          }

          if (!("targets" in stageObject)) return;
          const targets = stageObject.targets;
          if (!Array.isArray(targets) || targets.length === 0) {
            add("INVALID_INPUT", [...stagePath, "targets"], "targets must be a nonempty array.");
            return;
          }
          targets.forEach((target: unknown, t) => {
            const targetPath = [...stagePath, "targets", t];
            if (!object(target, targetPath, ["distance"])) return;
            const distance = (target as Record<string, unknown>).distance;
            const distancePath = [...targetPath, "distance"];
            if (distance === undefined || !object(distance, distancePath, ["value", "unit"]))
              return;
            const { value, unit } = distance as Record<string, unknown>;

            if ("value" in (distance as object)) {
              if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
                add(
                  "INVALID_INPUT",
                  [...distancePath, "value"],
                  "Distance must be a finite positive number.",
                );
              } else if (!Number.isSafeInteger(value)) {
                add(
                  "UNSUPPORTED_DISTANCE_PRECISION",
                  [...distancePath, "value"],
                  "Only whole-number distances are supported until fractional distances are tested in Quantum.",
                );
              }
            }
            if ("unit" in (distance as object)) {
              if (typeof unit !== "string") {
                add("INVALID_INPUT", [...distancePath, "unit"], "unit must be a string.");
              } else if (unit !== "yd") {
                add("UNSUPPORTED_UNIT", [...distancePath, "unit"], 'Only "yd" is supported.');
              }
            }
          });
        });
      }
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, request: input as MatchRequest };
}
