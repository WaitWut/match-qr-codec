import assert from "node:assert/strict";
import { test } from "node:test";
import Ajv2020Module from "ajv/dist/2020.js";
import { encodeMatch, validateRequest, type MatchRequest } from "../src/index.ts";
import { readJson, vectors } from "./helpers.ts";

const ajv = new Ajv2020Module.default({ allErrors: true, strict: true });
const requestSchema = ajv.compile(readJson("schemas/match-request.schema.json") as object);
const resultSchema = ajv.compile(readJson("schemas/match-result.schema.json") as object);
const optionsSchema = ajv.compile(readJson("schemas/encode-options.schema.json") as object);

function base(): MatchRequest {
  return {
    schemaVersion: "1",
    match: {
      name: "Sample Cup",
      stages: [{ name: "Fence", targets: [{ distance: { value: 63, unit: "yd" } }] }],
    },
  };
}

function mutate(change: (request: any) => void): unknown {
  const request = base() as any;
  change(request);
  return request;
}

/** [label, input, expected issues as "CODE path"] */
const cases: [string, unknown, string[]][] = [
  ["not an object", [], ["INVALID_INPUT "]],
  ["missing match", { schemaVersion: "1" }, ["INVALID_INPUT /match"]],
  ["unknown root property", mutate((r) => (r.extra = 1)), ["INVALID_INPUT /extra"]],
  [
    "schemaVersion as number",
    mutate((r) => (r.schemaVersion = 1)),
    ["INVALID_INPUT /schemaVersion"],
  ],
  [
    "schemaVersion 2",
    mutate((r) => (r.schemaVersion = "2")),
    ["UNSUPPORTED_SCHEMA_VERSION /schemaVersion"],
  ],
  ["empty match name", mutate((r) => (r.match.name = "")), ["INVALID_INPUT /match/name"]],
  ["whitespace-only name", mutate((r) => (r.match.name = "   ")), ["INVALID_INPUT /match/name"]],
  [
    "comma in stage name",
    mutate((r) => (r.match.stages[0].name = "Barricade, weak")),
    ["UNSUPPORTED_NAME /match/stages/0/name"],
  ],
  [
    "percent in match name",
    mutate((r) => (r.match.name = "100% Cup")),
    ["UNSUPPORTED_NAME /match/name"],
  ],
  ["line break in name", mutate((r) => (r.match.name = "A\nB")), ["UNSUPPORTED_NAME /match/name"]],
  [
    "non-ASCII name",
    mutate((r) => (r.match.stages[0].name = "Stage 1 – Fence")),
    ["UNSUPPORTED_NAME /match/stages/0/name"],
  ],
  [
    "duplicate stage names",
    mutate((r) => r.match.stages.push(structuredClone(r.match.stages[0]))),
    ["UNSUPPORTED_NAME /match/stages/1/name"],
  ],
  ["no stages", mutate((r) => (r.match.stages = [])), ["INVALID_INPUT /match/stages"]],
  [
    "no targets",
    mutate((r) => (r.match.stages[0].targets = [])),
    ["INVALID_INPUT /match/stages/0/targets"],
  ],
  [
    "unknown target property",
    mutate((r) => (r.match.stages[0].targets[0].label = "A")),
    ["INVALID_INPUT /match/stages/0/targets/0/label"],
  ],
  [
    "distance as string",
    mutate((r) => (r.match.stages[0].targets[0].distance.value = "63")),
    ["INVALID_INPUT /match/stages/0/targets/0/distance/value"],
  ],
  [
    "distance null",
    mutate((r) => (r.match.stages[0].targets[0].distance.value = null)),
    ["INVALID_INPUT /match/stages/0/targets/0/distance/value"],
  ],
  [
    "zero distance",
    mutate((r) => (r.match.stages[0].targets[0].distance.value = 0)),
    ["INVALID_INPUT /match/stages/0/targets/0/distance/value"],
  ],
  [
    "fractional distance",
    mutate((r) => (r.match.stages[0].targets[0].distance.value = 52.5)),
    ["UNSUPPORTED_DISTANCE_PRECISION /match/stages/0/targets/0/distance/value"],
  ],
  [
    "meters",
    mutate((r) => (r.match.stages[0].targets[0].distance.unit = "m")),
    ["UNSUPPORTED_UNIT /match/stages/0/targets/0/distance/unit"],
  ],
  [
    "missing distance",
    mutate((r) => delete r.match.stages[0].targets[0].distance),
    ["INVALID_INPUT /match/stages/0/targets/0/distance"],
  ],
  [
    "several problems at once",
    mutate((r) => {
      r.match.name = "a,b";
      r.match.stages[0].targets[0].distance = { value: 1.5, unit: "m" };
    }),
    [
      "UNSUPPORTED_NAME /match/name",
      "UNSUPPORTED_DISTANCE_PRECISION /match/stages/0/targets/0/distance/value",
      "UNSUPPORTED_UNIT /match/stages/0/targets/0/distance/unit",
    ],
  ],
];

/** Codes the JSON Schema cannot express; everything else is structural and the schema rejects it. */
const semanticOnly = new Set(["UNSUPPORTED_DISTANCE_PRECISION"]);

for (const [label, input, expected] of cases) {
  test(`validation: ${label}`, () => {
    const result = validateRequest(input);
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.deepEqual(
      result.issues.map((issue) => `${issue.code} ${issue.path}`),
      expected,
    );

    const structural = expected.some((issue) => !semanticOnly.has(issue.split(" ")[0]!));
    const nonAsciiOrDuplicate = /non-ASCII|whitespace|duplicate/.test(label);
    if (!nonAsciiOrDuplicate) {
      assert.equal(requestSchema(input), !structural, `schema disagrees on "${label}"`);
    }
  });
}

test("validation accepts the example request, and so does the schema", () => {
  const example = readJson("examples/request.json");
  assert.equal(validateRequest(example).ok, true);
  assert.equal(requestSchema(example), true);
});

test("results conform to the result schema", () => {
  const ok = encodeMatch(base(), { uuids: ["0123456789"], maxPayloadBytes: 2953 });
  assert.ok(ok.ok);
  assert.equal(resultSchema(ok), true, JSON.stringify(resultSchema.errors));

  const failure = encodeMatch(
    mutate((r) => (r.match.name = "")),
    {
      uuids: ["0123456789"],
      maxPayloadBytes: 2953,
    },
  );
  assert.equal(failure.ok, false);
  assert.equal(resultSchema(failure), true, JSON.stringify(resultSchema.errors));

  assert.equal(resultSchema(readJson("examples/failure.json")), true);
  assert.equal(resultSchema(readJson("examples/result.json")), true);
});

test("encoding options are validated", () => {
  const issues = (options: Parameters<typeof encodeMatch>[1]) => {
    const result = encodeMatch(base(), options);
    return result.ok ? [] : result.issues.map((issue) => issue.code);
  };
  assert.deepEqual(issues({ uuids: [], maxPayloadBytes: 2953 }), ["UNSUPPORTED_ENCODING_CONTEXT"]);
  assert.deepEqual(issues({ uuids: ["abcdef0123"], maxPayloadBytes: 2953 }), [
    "UNSUPPORTED_ENCODING_CONTEXT",
  ]);
  assert.deepEqual(issues({ uuids: ["0123456789"], maxPayloadBytes: 2954 }), [
    "UNSUPPORTED_ENCODING_CONTEXT",
  ]);
  assert.deepEqual(issues({ uuids: ["0123456789"], maxPayloadBytes: 100 }), [
    "UNSUPPORTED_ENCODING_CONTEXT",
  ]);
  assert.deepEqual(issues({ uuids: () => "0123456789", maxPayloadBytes: 2953 }), []);
});

test("a limit too small for one sector and one target is a capacity failure, not a partial match", () => {
  const result = encodeMatch(base(), { uuids: ["0123456789"], maxPayloadBytes: 160 });
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.deepEqual(
    result.issues.map((issue) => `${issue.code} ${issue.path}`),
    ["EXPORT_CAPACITY_UNSUPPORTED /match/stages/0/targets/0"],
  );
});

test("two parts may not share a UUID", () => {
  const request = mutate((r) => {
    r.match.stages.push({ name: "Bench", targets: [{ distance: { value: 88, unit: "yd" } }] });
  });
  const result = encodeMatch(request, { uuids: () => "0123456789", maxPayloadBytes: 200 });
  assert.equal(result.ok, false);
});

test("every vector's options and request conform to the schemas", () => {
  for (const { file, vector } of vectors()) {
    assert.equal(
      optionsSchema(vector.options),
      true,
      `${file}: ${JSON.stringify(optionsSchema.errors)}`,
    );
    assert.equal(
      requestSchema(vector.request),
      true,
      `${file}: ${JSON.stringify(requestSchema.errors)}`,
    );
  }
});
