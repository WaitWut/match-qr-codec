/**
 * Match Target Data, version 1.0 (draft): the neutral document producers write, and its
 * translation into AB Quantum's grouped-import payloads. See spec/match-target-data.md.
 */

import type { EncodeOptions, EncodeResult, Issue } from "./contract.ts";
import { encodeMatch } from "./encode.ts";
import { pointer } from "./pointer.ts";

export const DOCUMENT_FORMAT = "match-target-data";
export const DOCUMENT_VERSION = "1.0";

export type DocumentUnit = "yd" | "m";

export interface DocumentTarget {
  /** Proposed. */
  label?: string;
  distance: { value: number; unit: DocumentUnit };
}

export interface DocumentStage {
  name: string;
  targets: DocumentTarget[];
}

export interface DocumentMatch {
  /** Proposed. */
  id?: string;
  /** Proposed. Requires `id`. */
  revision?: string;
  name: string;
  stages: DocumentStage[];
}

export interface MatchTargetData {
  format: typeof DOCUMENT_FORMAT;
  version: typeof DOCUMENT_VERSION;
  match: DocumentMatch;
}

export type DocumentValidation =
  { ok: true; document: MatchTargetData } | { ok: false; issues: Issue[] };

type Path = (string | number)[];

/** At least one character that is not a space, and no control characters. Same as the schema. */
const TEXT = /^[^\u0000-\u001F\u007F]*[^\s\u0000-\u001F\u007F][^\u0000-\u001F\u007F]*$/u;

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates a Match Target Data document against version 1.0. Collects every issue rather than
 * stopping at the first. Checks what the specification says, not what any consumer can import.
 */
export function validateDocument(input: unknown): DocumentValidation {
  const issues: Issue[] = [];
  const add = (code: Issue["code"], path: Path, message: string) =>
    issues.push({ code, path: pointer(...path), message });

  const object = (
    value: unknown,
    path: Path,
    required: readonly string[],
    optional: readonly string[] = [],
  ): value is Record<string, unknown> => {
    if (!isPlainObject(value)) {
      add("INVALID_INPUT", path, "Expected an object.");
      return false;
    }
    for (const key of Object.keys(value)) {
      if (!required.includes(key) && !optional.includes(key))
        add("INVALID_INPUT", [...path, key], "Unknown property.");
    }
    for (const key of required) {
      if (!(key in value)) add("INVALID_INPUT", [...path, key], "Required property is missing.");
    }
    return true;
  };

  const text = (value: unknown, path: Path, label: string) => {
    if (typeof value !== "string" || !TEXT.test(value)) {
      add(
        "INVALID_INPUT",
        path,
        `${label} must be text with at least one non-space character and no control characters.`,
      );
    }
  };

  if (!object(input, [], ["format", "version", "match"])) return { ok: false, issues };

  if ("format" in input && input.format !== DOCUMENT_FORMAT) {
    add("INVALID_INPUT", ["format"], `format must be "${DOCUMENT_FORMAT}".`);
  }

  if ("version" in input) {
    const version = input.version;
    if (typeof version !== "string" || !VERSION.test(version)) {
      add("INVALID_INPUT", ["version"], 'version must be a string of the form "MAJOR.MINOR".');
    } else if (version !== DOCUMENT_VERSION) {
      add(
        "UNSUPPORTED_SCHEMA_VERSION",
        ["version"],
        `This implementation reads version ${DOCUMENT_VERSION} documents; got ${version}.`,
      );
    }
  }

  const match = input.match;
  if ("match" in input && object(match, ["match"], ["name", "stages"], ["id", "revision"])) {
    if ("id" in match) text(match.id, ["match", "id"], "Match id");
    if ("revision" in match) {
      text(match.revision, ["match", "revision"], "Match revision");
      if (!("id" in match))
        add("INVALID_INPUT", ["match", "revision"], "revision requires an id to belong to.");
    }
    if ("name" in match) text(match.name, ["match", "name"], "Match name");

    if ("stages" in match) {
      const stages = match.stages;
      if (!Array.isArray(stages) || stages.length === 0) {
        add("INVALID_INPUT", ["match", "stages"], "stages must be a nonempty array.");
      } else {
        stages.forEach((stage: unknown, s) => {
          const stagePath = ["match", "stages", s];
          if (!object(stage, stagePath, ["name", "targets"])) return;
          if ("name" in stage) text(stage.name, [...stagePath, "name"], "Stage name");

          if (!("targets" in stage)) return;
          const targets = stage.targets;
          if (!Array.isArray(targets) || targets.length === 0) {
            add("INVALID_INPUT", [...stagePath, "targets"], "targets must be a nonempty array.");
            return;
          }
          targets.forEach((target: unknown, t) => {
            const targetPath = [...stagePath, "targets", t];
            if (!object(target, targetPath, ["distance"], ["label"])) return;
            if ("label" in target) text(target.label, [...targetPath, "label"], "Target label");

            const distancePath = [...targetPath, "distance"];
            if (
              !("distance" in target) ||
              !object(target.distance, distancePath, ["value", "unit"])
            )
              return;
            const { value, unit } = target.distance;
            if (
              "value" in target.distance &&
              (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
            ) {
              add(
                "INVALID_INPUT",
                [...distancePath, "value"],
                "Distance must be a finite positive number.",
              );
            }
            if ("unit" in target.distance && unit !== "yd" && unit !== "m") {
              add("INVALID_INPUT", [...distancePath, "unit"], 'unit must be "yd" or "m".');
            }
          });
        });
      }
    }
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, document: input as unknown as MatchTargetData };
}

/**
 * Translates a Match Target Data document into AB Quantum grouped-import payloads, in scan order.
 *
 * The whole match or a failure, never a partial match. Problems with the document are reported
 * first; the options are checked once the document is valid. Paths in every issue point into the
 * document. `match.id`, `match.revision` and target labels are ignored: Quantum's format has no
 * known place for them. Everything else the encoder cannot carry is rejected, not changed.
 */
export function encodeDocument(input: unknown, options: EncodeOptions): EncodeResult {
  const validation = validateDocument(input);
  if (!validation.ok) return validation;
  const { match } = validation.document;
  return encodeMatch(
    {
      schemaVersion: "1",
      match: {
        name: match.name,
        stages: match.stages.map((stage) => ({
          name: stage.name,
          targets: stage.targets.map((target) => ({
            distance: { value: target.distance.value, unit: target.distance.unit },
          })),
        })),
      },
    },
    options,
  );
}
