# Match QR contract, version 1 (draft)

This specifies the encoder: the request `encodeMatch` takes and the result it returns. The JSON
Schemas in `schemas/` describe the structure; this document adds the rules a schema cannot express.
Version 1 is a draft until it has been reviewed; see [Versions](#versions).

Match software that is not tied to this encoder should write
[Match Target Data](../spec/match-target-data.md) instead. `encodeDocument` translates a document
into this request and returns the same result, with every issue path pointing into the document.

Schema validation establishes structure, not that Quantum will import the result. What has
actually been tested in the app is in [compatibility.md](compatibility.md).

## Workflow

Complete match JSON → `encodeMatch` validates it → records are built, split and masked → an
ordered list of payload strings → the consumer renders each string as one QR code.

The reference implementation is a TypeScript function with no runtime dependencies. It runs in a
browser or Node. Other implementations can follow this contract and check themselves against the
vectors in `test/vectors/`. No hosted service is involved.

The calling application owns match preparation and publishing. Quantum owns profiles,
conditions and ballistic solutions. Nothing returned here is a ballistic result.

## Request

`encodeMatch(request, options)`. The request is JSON. Every field is required and unknown
properties are rejected. See `schemas/match-request.schema.json` and `examples/request.json`.

| Field                      | Rule                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`            | The string `"1"`. Identifies this contract, not the Quantum app or package version.                                                     |
| `match.name`               | Group name in Quantum. Repeated in every sector record.                                                                                 |
| `match.stages`             | Nonempty, ordered. Order is preserved.                                                                                                  |
| `stages[].name`            | Sector name in Quantum. Unique within the match.                                                                                        |
| `stages[].targets`         | Nonempty, ordered list of the stage's distinct targets. A target engaged more than once appears once; that mapping is the caller's job. |
| `targets[].distance.value` | Finite, positive number.                                                                                                                |
| `targets[].distance.unit`  | `"yd"`. States the caller's intent; how Quantum interprets the number under each unit setting is untested.                              |

### Restrictions of the current encoding

The schema accepts some values that this version of the encoder rejects, because their handling in
Quantum has not been established. These fail with a specific code, never by silent change:

- **Names** must be printable ASCII and contain no comma, percent sign or line break
  (`UNSUPPORTED_NAME`). Commas and percent signs delimit the record format and no escaping is
  known. Whitespace-only names are `INVALID_INPUT`.
- **Duplicate stage names** are rejected (`UNSUPPORTED_NAME`) until Quantum's handling of
  duplicate sectors is tested.
- **Fractional distances** are rejected (`UNSUPPORTED_DISTANCE_PRECISION`) until a fractional
  import is tested.
- **No length limit** is imposed on names. AB's own exporter truncated a group name to 20
  characters in one sample; that is recorded, not enforced. Names are never truncated or
  renamed.

## Options

Options are separate from the request because they are not match data. They control envelope
identity and code size, which each consumer must decide.

| Option            | Rule                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `uuids`           | One envelope UUID per code, in part order: ten uppercase hex characters. An array (extra entries ignored) or, in TypeScript, a function of the 1-based part number. No two parts may share one. The codec never invents UUIDs. |
| `maxPayloadBytes` | Largest UTF-8 length of any returned `text`. An integer from 115 to 2953 (version 40 at error correction L). Pick it from the error correction level and printed size you have tested; see [rendering.md](rendering.md).       |

The JSON form, used by the test vectors, is `schemas/encode-options.schema.json`.

The UUID policy is unresolved: whether Quantum uses the UUID to recognise a re-import, an
update or a duplicate is unknown. Supplying UUIDs makes output deterministic, which is required
for test vectors and for showing the same code on screen, in print and in a download. How the
caller chooses them (random per export, stored per match, derived) is its own decision until
Quantum's behavior is known.

## Result

Success:

```json
{ "ok": true, "schemaVersion": "1", "payloads": [{ "part": 1, "text": "{...}" }] }
```

- `payloads` is nonempty and in scan order. Its length is the number of codes. A small match
  returns one item; the shape does not change.
- `part` is consecutive from 1. It is display metadata for labels like "Code 2 of 3". It is
  not in the encoded envelope, and no part number or count is added to the wire format.
- `text` is one complete Quantum envelope. Encode it as-is in one QR code.
- The same request and options always return the same result.

Failure:

```json
{
  "ok": false,
  "issues": [
    {
      "code": "UNSUPPORTED_UNIT",
      "path": "/match/stages/0/targets/0/distance/unit",
      "message": "..."
    }
  ]
}
```

- `issues` is nonempty and lists every problem found, not just the first.
- `path` is a JSON Pointer into the request, or `""` for the whole request or the options.
- `code` is stable within the contract version. `message` is for people and may change.

The result is the whole match or a failure. A target is never dropped and a partial match is never
returned as success.

### Error codes

| Code                             | Meaning                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `INVALID_INPUT`                  | Structurally invalid: wrong type, missing or unknown property, empty array, nonpositive distance.        |
| `UNSUPPORTED_SCHEMA_VERSION`     | `schemaVersion` is a string other than `"1"`.                                                            |
| `UNSUPPORTED_UNIT`               | A unit other than `"yd"`.                                                                                |
| `UNSUPPORTED_DISTANCE_PRECISION` | A distance that is not a whole number.                                                                   |
| `UNSUPPORTED_NAME`               | A name with a delimiter or non-ASCII character, or a duplicate stage name.                               |
| `UNSUPPORTED_ENCODING_CONTEXT`   | Bad options: too few, malformed or repeated UUIDs; `maxPayloadBytes` out of range.                       |
| `EXPORT_CAPACITY_UNSUPPORTED`    | One sector record plus one target does not fit in `maxPayloadBytes`. `path` points at the target.        |
| `INVALID_PAYLOAD`                | Decoders only: the payload is malformed, or a code is missing or out of order.                           |
| `UNSUPPORTED_PAYLOAD`            | Decoders only: well formed, but carries something a request cannot represent (unknown attributes, etc.). |

Rendering failure is the consumer's, separate from these, and must be shown to the user, not
hidden.

## Splitting

Each code is a complete envelope with its own UUID. Records are never split. When a stage
continues into the next code, that code repeats the stage's sector record and carries on from the
next target index rather than restarting at zero. A sector record never ends a code without a
target after it. This is how AB's own two-code export behaves, and with AB's limit the encoder
reproduces that export byte for byte.

Whether Quantum accepts splits at points other than AB's, and what it does with codes scanned out
of order, repeated or missing, is untested.

## Diagnostic decoders

- `decodePayload(text)` returns the envelope, the unmasked record stream and the parsed records.
  `matchesObservedEnvelope` says whether the envelope's fixed fields equal the observed export.
- `decodeMatch(texts)` reassembles a request from payloads in scan order. It fails on gaps,
  reordering, inconsistent group names, empty sectors and target attributes a request cannot
  carry, instead of guessing. Distances come back as `"yd"` because the payload has no unit.

These exist for testing and support, not to read arbitrary Quantum exports.

## Versions

`schemaVersion` is independent of the package version. Each release's changelog lists the
contract versions it supports. A change that rejects a previously accepted request or changes
result semantics needs a new major contract version. A change to the internal encoding that keeps
the contract (for example, after AB confirms a field) is a package release; consumers still have to
take the update to get it.

Codes already printed or downloaded are snapshots. Nothing here promises they keep working with
future Quantum versions.
