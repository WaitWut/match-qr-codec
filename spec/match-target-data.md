# Match Target Data, version 1.0 (draft)

**Draft.** This specification may change incompatibly before version 1.0 is final, so nothing
should ship against it yet. Match Director HQ wrote it as a proposal for review by its first
consumer, AB Quantum.

## Why it exists

Match software knows a match's stages and target distances. Apps that calculate firing solutions
need them, without a competitor typing them in. Each app has its own import format, and that format
can change. When every match platform writes every app's format directly, each format change breaks
every platform.

Match Target Data is a neutral layer between them. A producer writes one document. A consumer reads
it, either directly or through a translator into its own format. The consumer can then change its
internal format without breaking producers, as long as it keeps reading this one or keeps its
translator current.

## Roles

| Role       | Who                                   | Responsibility                                                        |
| ---------- | ------------------------------------- | --------------------------------------------------------------------- |
| Producer   | Match software that publishes a match | Writes a valid document from the match as published                   |
| Consumer   | An app that imports a match's targets | Reads documents, or names a translator it accepts                     |
| Translator | Code between the two                  | Converts a document into one consumer's import format, all or nothing |

One translator exists today: `encodeDocument` in this repository turns a document into AB Quantum's
grouped-import QR codes. Match Director HQ maintains it, not Applied Ballistics. Its limits are in
[Translating for AB Quantum](#translating-for-ab-quantum).

## The document

One JSON object, encoded as UTF-8:

```json
{
  "format": "match-target-data",
  "version": "1.0",
  "match": {
    "id": "6f1c2a9e-4b7d-4e2a-9f3c-1d8b5e0a7c42",
    "revision": "2026-10-24T14:05:00Z",
    "name": "Sample Cup",
    "stages": [
      {
        "name": "Fence",
        "targets": [
          { "label": "T1", "distance": { "value": 63, "unit": "yd" } },
          { "label": "T2", "distance": { "value": 112, "unit": "yd" } }
        ]
      },
      {
        "name": "Bench",
        "targets": [{ "distance": { "value": 80, "unit": "m" } }]
      }
    ]
  }
}
```

### Fields

| Field                      | Required     | Rule                                                                                          |
| -------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| `format`                   | Yes          | The string `"match-target-data"`. Lets a consumer recognise a document wherever it finds one. |
| `version`                  | Yes          | `"MAJOR.MINOR"`. This draft is `"1.0"`. See [Versions](#versions).                            |
| `match.id`                 | No, proposed | Identifies the match across revisions. Globally unique; a UUID is recommended.                |
| `match.revision`           | No, proposed | Changes whenever the document's content changes. Compare for equality only. Requires `id`.    |
| `match.name`               | Yes          | The match name as published.                                                                  |
| `match.stages`             | Yes          | Nonempty, in matchbook order.                                                                 |
| `stages[].name`            | Yes          | The stage name as published.                                                                  |
| `stages[].targets`         | Yes          | Nonempty. The stage's distinct targets, in the order they are first engaged.                  |
| `targets[].label`          | No, proposed | The target's name or letter in the matchbook, such as `"T3"` or `"Plate A"`.                  |
| `targets[].distance.value` | Yes          | A positive number.                                                                            |
| `targets[].distance.unit`  | Yes          | `"yd"` or `"m"`.                                                                              |

`match.id`, `match.revision` and `targets[].label` are proposed: they stay in the draft only if the
first consumer has a use for them.

### Rules

- **Text** (names, labels, `id`, `revision`) is Unicode with at least one character that is not a
  space, and no control characters (U+0000 to U+001F, U+007F). The specification sets no length
  limit. Producers send names as published. They never shorten, rename or strip characters to suit
  a consumer.
- **Distances** are sent in the unit and to the precision the match was designed in. Producers
  never convert or round. A consumer that needs another unit converts, and says so.
- **A target engaged more than once in a stage appears once**, in the order it is first engaged.
  Targets are never merged because they share a distance, and never across stages: a physical
  target used in two stages appears in each.
- **Every stage has at least one target, and every target has a distance.** If part of a match
  cannot be described, for example a target with no distance, the producer either leaves it out or
  produces no document. Either way, it tells the person preparing the match.
- **Unknown properties are errors.** A consumer that finds a property it does not know rejects the
  document instead of ignoring it, so nothing is lost silently. New optional properties arrive in a
  new minor version.
- **Identity (proposed).** `id` stays the same for the life of a match and `revision` changes
  whenever the content does, so a consumer that has already imported a match can tell an update
  from a new match. Whether it replaces the match, offers to, or keeps both is the consumer's
  decision. The first consumer's answer may change these fields.

## Versions

- `version` is `MAJOR.MINOR`, independent of any package or app version.
- A minor version only adds optional properties or allowed values. A major version may change
  anything.
- A consumer that knows `MAJOR.N` reads any `MAJOR.M` where `M` is at most `N`, and rejects
  everything else.
- A producer writes the lowest version that can hold its document, so older consumers can read it.
- While this specification is a draft, 1.0 itself may change. It becomes final once the first
  consumer has reviewed it.

## Getting a document to a consumer

This specification describes the document, not how it travels. Three routes are possible. No
consumer supports any of them yet.

- **A file** the competitor saves and opens in the consumer.
- **A link.** A QR code or button holds a URL, and the consumer fetches the document. One small
  code covers a match of any size, and it can always return the current revision.
- **A QR code holding the document.** Needs no network, but a full match needs several codes, as it
  does today in Quantum's own format.

Until a consumer reads documents directly, a translator turns them into its own format.

## Translators

A translator:

- converts the whole document or fails, and never returns part of a match;
- reports every problem, each with a stable code and a JSON Pointer into the document;
- never shortens a name, rounds or converts a distance, or drops a target to make a document fit;
- publishes what it carries, what it ignores because the consumer's format has no place for it, and
  what it rejects.

### Translating for AB Quantum

`encodeDocument(document, options)` in this repository produces AB Quantum grouped-import QR
payloads with the encoder described in [docs/api-contract.md](../docs/api-contract.md). Quantum's
format was learned from codes the app exported; AB has not published it. What has been tested in
the app is recorded in [docs/compatibility.md](../docs/compatibility.md).

| Document                                                                   | In Quantum                                                                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `match.name`                                                               | Carried, as the group name repeated in every sector                                                      |
| `stages[].name`                                                            | Carried, as the sector name                                                                              |
| `targets`, in order                                                        | Carried, as the sector's targets numbered from zero                                                      |
| `distance` in `"yd"`, whole numbers                                        | Carried                                                                                                  |
| `distance` in `"m"`                                                        | Rejected, `UNSUPPORTED_UNIT`. How Quantum reads units is untested.                                       |
| Fractional `distance`                                                      | Rejected, `UNSUPPORTED_DISTANCE_PRECISION`. Untested.                                                    |
| Names with a comma, percent sign or line break, or outside printable ASCII | Rejected, `UNSUPPORTED_NAME`. Commas and percent signs separate Quantum's records; no escaping is known. |
| Two stages with the same name                                              | Rejected, `UNSUPPORTED_NAME`. Untested.                                                                  |
| `match.id`, `match.revision`, `targets[].label`                            | Ignored. Quantum's format has no known place for them.                                                   |

Every code also carries values the document does not supply:

- Quantum's envelope fields exactly as observed, including `appVersion` `"792"`, `dataType` `1` and
  `versionType` `0`. Every generated code therefore presents itself as coming from that version of
  the app.
- A ten-character UUID per code, chosen by the caller.
- Four target fields whose meaning is unknown, always `0`, empty, `0`, `0`.

See [docs/quantum-format-observations.md](../docs/quantum-format-observations.md).

## Conformance

- [`match-target-data.schema.json`](match-target-data.schema.json) is the JSON Schema for version
  1.0. It expresses every rule above except the ones only the producer can know: that targets are
  distinct and in first-engagement order.
- `validateDocument` in this repository applies the same rules and reports each problem with a code
  and a JSON Pointer.
- [`examples/`](examples) holds documents. The tests check each against the schema and
  `validateDocument`, and check what the AB Quantum translator does with it.

## Changes

Propose changes as issues or pull requests in this repository. Any producer or consumer can. A
change names the version it belongs in, under the rules in [Versions](#versions).

## Open questions for the first consumer

1. Will the consumer read documents directly, and by which route: file, link or QR code?
2. Which target properties beyond distance should the specification carry? Quantum's targets have
   fields that every observed export left at `0` or empty, and its target card shows azimuth,
   inclination and target speed.
3. When a document arrives whose `id` was imported before, should the consumer replace the match,
   offer to, or keep both? Do `id` and `revision` give it what it needs?
4. How should the consumer treat a distance in meters when the competitor's app is set to yards,
   and the reverse?
