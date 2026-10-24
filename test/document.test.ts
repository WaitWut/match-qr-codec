import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import Ajv2020Module from "ajv/dist/2020.js";
import { encodeDocument, encodeMatch, validateDocument } from "../src/index.ts";
import { readJson } from "./helpers.ts";

const ajv = new Ajv2020Module.default({ allErrors: true, strict: true });
const documentSchema = ajv.compile(readJson("spec/match-target-data.schema.json") as object);

const options = { uuids: ["5A3C9E1B07", "6B4DAF2C18", "7C5EB03D29"], maxPayloadBytes: 1000 };

function base(): any {
  return {
    format: "match-target-data",
    version: "1.0",
    match: {
      name: "Sample Cup",
      stages: [{ name: "Fence", targets: [{ distance: { value: 63, unit: "yd" } }] }],
    },
  };
}

function mutate(change: (document: any) => void): unknown {
  const document = base();
  change(document);
  return document;
}

/** What the AB Quantum translator does with each example: payloads, or these issues. */
const exampleOutcomes: Record<string, "encodes" | string[]> = {
  "sample-cup.json": "encodes",
  "sample-cup-with-identity.json": "encodes",
  "metric-and-fractional.json": [
    "UNSUPPORTED_NAME /match/stages/0/name",
    "UNSUPPORTED_UNIT /match/stages/0/targets/0/distance/unit",
    "UNSUPPORTED_DISTANCE_PRECISION /match/stages/0/targets/1/distance/value",
  ],
};

test("every example has an expected outcome", () => {
  const files = readdirSync(new URL("../spec/examples/", import.meta.url)).filter((file) =>
    file.endsWith(".json"),
  );
  assert.deepEqual(files.sort(), Object.keys(exampleOutcomes).sort());
});

for (const [file, outcome] of Object.entries(exampleOutcomes)) {
  test(`example ${file} is a valid document`, () => {
    const document = readJson(`spec/examples/${file}`);
    assert.equal(documentSchema(document), true, JSON.stringify(documentSchema.errors));
    assert.deepEqual(validateDocument(document), { ok: true, document });
  });

  test(`example ${file} translates for AB Quantum as expected`, () => {
    const result = encodeDocument(readJson(`spec/examples/${file}`), options);
    if (outcome === "encodes") {
      assert.ok(result.ok, JSON.stringify(result));
    } else {
      assert.ok(!result.ok);
      assert.deepEqual(
        result.issues.map((issue) => `${issue.code} ${issue.path}`),
        outcome,
      );
    }
  });
}

test("a document translates to exactly what the equivalent encoder request produces", () => {
  const fromDocument = encodeDocument(readJson("spec/examples/sample-cup.json"), options);
  const fromRequest = encodeMatch(readJson("examples/request.json"), options);
  assert.ok(fromDocument.ok);
  assert.deepEqual(fromDocument, fromRequest);
});

test("id, revision and labels do not change the Quantum payloads", () => {
  const plain = encodeDocument(readJson("spec/examples/sample-cup.json"), options);
  const withIdentity = encodeDocument(
    readJson("spec/examples/sample-cup-with-identity.json"),
    options,
  );
  assert.ok(plain.ok);
  assert.deepEqual(withIdentity, plain);
});

test("option problems are reported once the document is valid", () => {
  const result = encodeDocument(base(), { uuids: [], maxPayloadBytes: 1000 });
  assert.ok(!result.ok);
  assert.deepEqual(
    result.issues.map((issue) => `${issue.code} ${issue.path}`),
    ["UNSUPPORTED_ENCODING_CONTEXT "],
  );
});

test("Unicode names are valid documents", () => {
  const document = mutate((d) => (d.match.stages[0].name = "Étape 1 – Clôture"));
  assert.equal(validateDocument(document).ok, true);
  assert.equal(documentSchema(document), true);
});

/** [label, input, expected issues as "CODE path"]. The schema rejects every one of them. */
const invalid: [string, unknown, string[]][] = [
  ["not an object", [], ["INVALID_INPUT "]],
  ["missing format", mutate((d) => delete d.format), ["INVALID_INPUT /format"]],
  ["another format", mutate((d) => (d.format = "match-request")), ["INVALID_INPUT /format"]],
  ["version as number", mutate((d) => (d.version = 1)), ["INVALID_INPUT /version"]],
  ["version without minor", mutate((d) => (d.version = "1")), ["INVALID_INPUT /version"]],
  ["a later minor", mutate((d) => (d.version = "1.1")), ["UNSUPPORTED_SCHEMA_VERSION /version"]],
  ["a later major", mutate((d) => (d.version = "2.0")), ["UNSUPPORTED_SCHEMA_VERSION /version"]],
  [
    "revision without id",
    mutate((d) => (d.match.revision = "3")),
    ["INVALID_INPUT /match/revision"],
  ],
  ["empty id", mutate((d) => (d.match.id = "")), ["INVALID_INPUT /match/id"]],
  ["whitespace-only name", mutate((d) => (d.match.name = "  ")), ["INVALID_INPUT /match/name"]],
  [
    "control character in a stage name",
    mutate((d) => (d.match.stages[0].name = "Fence\tLeft")),
    ["INVALID_INPUT /match/stages/0/name"],
  ],
  [
    "empty label",
    mutate((d) => (d.match.stages[0].targets[0].label = "")),
    ["INVALID_INPUT /match/stages/0/targets/0/label"],
  ],
  [
    "unknown target property",
    mutate((d) => (d.match.stages[0].targets[0].size = 2)),
    ["INVALID_INPUT /match/stages/0/targets/0/size"],
  ],
  ["no stages", mutate((d) => (d.match.stages = [])), ["INVALID_INPUT /match/stages"]],
  [
    "no targets",
    mutate((d) => (d.match.stages[0].targets = [])),
    ["INVALID_INPUT /match/stages/0/targets"],
  ],
  [
    "zero distance",
    mutate((d) => (d.match.stages[0].targets[0].distance.value = 0)),
    ["INVALID_INPUT /match/stages/0/targets/0/distance/value"],
  ],
  [
    "feet",
    mutate((d) => (d.match.stages[0].targets[0].distance.unit = "ft")),
    ["INVALID_INPUT /match/stages/0/targets/0/distance/unit"],
  ],
];

for (const [label, input, expected] of invalid) {
  test(`document validation: ${label}`, () => {
    const result = validateDocument(input);
    assert.ok(!result.ok);
    assert.deepEqual(
      result.issues.map((issue) => `${issue.code} ${issue.path}`),
      expected,
    );
    assert.equal(documentSchema(input), false, `schema accepts "${label}"`);
  });
}
