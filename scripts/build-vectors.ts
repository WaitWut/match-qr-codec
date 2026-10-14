/**
 * Regenerates test/vectors/*.json and examples/result.json.
 *
 * Observed and derived vectors take their expected payloads from the fixture files, never from
 * the encoder, so the vector test is an independent check. Synthetic vectors take theirs from the
 * encoder and are regression locks only. Run: node --experimental-strip-types scripts/build-vectors.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodeMatch, decodePayload, encodeMatch, type MatchRequest } from "../src/index.ts";

const root = new URL("../", import.meta.url);
const fixture = (name: string) =>
  readFileSync(new URL(`test/private-fixtures/${name}`, root), "utf8");

function records(texts: string[]): string[][] {
  return texts.map((text) => {
    const decoded = decodePayload(text);
    if (!decoded.ok) throw new Error(JSON.stringify(decoded.issues));
    return decoded.stream
      .slice(0, -1)
      .split("%")
      .map((record) => `${record}%`);
  });
}

function fromFixtures(texts: string[]): MatchRequest {
  const decoded = decodeMatch(texts);
  if (!decoded.ok) throw new Error(JSON.stringify(decoded.issues));
  return decoded.request;
}

interface Spec {
  file: string;
  description: string;
  provenance: { kind: "observed" | "derived" | "synthetic"; source: string; appImport: string };
  request: MatchRequest;
  options: { uuids: string[]; maxPayloadBytes: number };
  /** Fixture texts for observed and derived vectors; omitted for synthetic ones. */
  texts?: string[];
}

const largeExport = [
  fixture("ab-large-export-part-1.payload.txt"),
  fixture("ab-large-export-part-2.payload.txt"),
];
const singleExport = [fixture("ab-single-export.payload.txt")];
const importTest = [fixture("import-test.payload.txt")];

const stage = (name: string, distances: number[]) => ({
  name,
  targets: distances.map((value) => ({ distance: { value, unit: "yd" as const } })),
});

const specs: Spec[] = [
  {
    file: "ab-large-export.json",
    description:
      "AB's two-code export of Large Export Test: six sectors of six targets, split inside Sector 6. Any maxPayloadBytes from 1921 to 1960 reproduces AB's split.",
    provenance: {
      kind: "observed",
      source:
        "Exported by AB Quantum (envelope appVersion 792), supplied 2026-10-14. Private evidence.",
      appImport: "Not imported into Quantum by us.",
    },
    request: fromFixtures(largeExport),
    options: { uuids: ["32A13D34F3", "B415579EA5"], maxPayloadBytes: 1921 },
    texts: largeExport,
  },
  {
    file: "ab-single-export.json",
    description:
      "AB's single-code export of the PFG rimfire match, six sectors and twelve targets. The group name is truncated to 20 characters by AB's exporter.",
    provenance: {
      kind: "observed",
      source:
        "Exported by AB Quantum (envelope appVersion 792), supplied 2026-10-08. Private evidence.",
      appImport: "Not imported into Quantum by us.",
    },
    request: fromFixtures(singleExport),
    options: { uuids: ["3FAF2AD33A"], maxPayloadBytes: 2953 },
    texts: singleExport,
  },
  {
    file: "import-test.json",
    description:
      "The PFG export with the group renamed to 'qr import test' and every distance increased by one, keeping AB's UUID.",
    provenance: {
      kind: "derived",
      source:
        "Generated 2026-10-09 from the AB single-code export by the earlier analysis scripts; the UUID is AB's.",
      appImport:
        "Eric reported a successful Quantum import on 2026-10-09. Platform and app version not recorded.",
    },
    request: fromFixtures(importTest),
    options: { uuids: ["3FAF2AD33A"], maxPayloadBytes: 2953 },
    texts: importTest,
  },
  {
    file: "sample-cup.json",
    description:
      "The contract's example request (examples/request.json): two stages, three and one targets.",
    provenance: {
      kind: "synthetic",
      source:
        "UUID 5A3C9E1B07 chosen arbitrarily for this vector, not observed. Expected payload produced by this codec.",
      appImport: "Untested. Needed: the structurally fresh match row of the validation plan.",
    },
    request: JSON.parse(readFileSync(new URL("examples/request.json", root), "utf8")),
    options: { uuids: ["5A3C9E1B07"], maxPayloadBytes: 2953 },
  },
  {
    file: "repeated-distance.json",
    description:
      "Distinct targets that share a distance, within a stage and across stages. Nothing is merged.",
    provenance: {
      kind: "synthetic",
      source: "UUID chosen arbitrarily. Expected payload produced by this codec.",
      appImport: "Untested.",
    },
    request: {
      schemaVersion: "1",
      match: {
        name: "Repeat Test",
        stages: [stage("Rooftop", [100, 100, 250]), stage("Tank", [100])],
      },
    },
    options: { uuids: ["0F1E2D3C4B"], maxPayloadBytes: 2953 },
  },
  {
    file: "eight-stage-capacity.json",
    description:
      "A realistic full match, eight stages of six targets, at a 1000-byte limit. Splits into several codes, some mid-stage.",
    provenance: {
      kind: "synthetic",
      source: "UUIDs chosen arbitrarily. Expected payloads produced by this codec.",
      appImport: "Untested. Whether Quantum accepts splits at points other than AB's is unknown.",
    },
    request: {
      schemaVersion: "1",
      match: {
        name: "Capacity Test",
        stages: Array.from({ length: 8 }, (_, s) =>
          stage(
            `Stage ${s + 1}`,
            Array.from({ length: 6 }, (_, t) => 50 + 25 * ((s + 3 * t) % 11)),
          ),
        ),
      },
    },
    options: {
      uuids: ["1A2B3C4D5E", "2B3C4D5E6F", "3C4D5E6F70", "4D5E6F7081", "5E6F708192"],
      maxPayloadBytes: 1000,
    },
  },
];

for (const spec of specs) {
  let texts = spec.texts;
  if (texts === undefined) {
    const result = encodeMatch(spec.request, spec.options);
    if (!result.ok) throw new Error(`${spec.file}: ${JSON.stringify(result.issues)}`);
    texts = result.payloads.map((payload) => payload.text);
    spec.options.uuids = spec.options.uuids.slice(0, texts.length);
  }
  const vector = {
    description: spec.description,
    provenance: spec.provenance,
    request: spec.request,
    options: spec.options,
    expected: {
      payloads: texts.map((text, i) => ({ part: i + 1, text })),
      records: records(texts),
    },
  };
  writeFileSync(new URL(`test/vectors/${spec.file}`, root), JSON.stringify(vector, null, 2) + "\n");
  console.log(`${spec.file}: ${texts.length} payload(s)`);
}

const example = encodeMatch(specs.find((spec) => spec.file === "sample-cup.json")!.request, {
  uuids: ["5A3C9E1B07"],
  maxPayloadBytes: 2953,
});
writeFileSync(new URL("examples/result.json", root), JSON.stringify(example, null, 2) + "\n");
