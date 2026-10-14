# match-qr-codec

Turns a precision rifle match's stages and target distances into the QR payloads AB Quantum's
grouped import reads, and reads them back.

**Experimental.** The format was learned from codes Quantum exported, not from an AB
specification. The encoder reproduces AB's own exports byte for byte, and codes it built
from fresh matches, including a three-code split, have imported on Android. See
[docs/compatibility.md](docs/compatibility.md) before relying on anything.

The codec is independent of any match application. It needs no server and has no runtime
dependencies; it runs in a browser or Node 22.13+.

## Use

```ts
import { encodeMatch } from "match-qr-codec";

const result = encodeMatch(
  {
    schemaVersion: "1",
    match: {
      name: "Sample Cup",
      stages: [
        {
          name: "Fence",
          targets: [
            { distance: { value: 63, unit: "yd" } },
            { distance: { value: 112, unit: "yd" } },
          ],
        },
      ],
    },
  },
  { uuids: ["5A3C9E1B07", "6B4DAF2C18", "7C5EB03D29"], maxPayloadBytes: 1000 },
);

if (result.ok) {
  for (const { part, text } of result.payloads) {
    // Render `text` as one QR code, labelled `Code ${part} of ${result.payloads.length}`.
  }
} else {
  for (const issue of result.issues) {
    // Show issue.message against the stage or target at issue.path.
  }
}
```

- The whole match or a failure, never a partial match. Failures list every issue, each with a
  stable code and a JSON Pointer.
- Deterministic: the same request and options give the same codes.
- `uuids`: one per code; ten uppercase hex characters. The codec never invents them.
- `maxPayloadBytes`: the largest code you can print and scan reliably. A full match usually needs
  several codes; see [docs/rendering.md](docs/rendering.md).

`decodePayload` and `decodeMatch` read codes back, for tests and support.

## Documents

| File                                                                       | What it covers                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| [docs/api-contract.md](docs/api-contract.md)                               | The contract: fields, options, results, errors, versions |
| [docs/quantum-format-observations.md](docs/quantum-format-observations.md) | What the Quantum format is known to be, and how we know  |
| [docs/compatibility.md](docs/compatibility.md)                             | What has been tested, in code and in the app             |
| [docs/rendering.md](docs/rendering.md)                                     | Error correction, code size, several codes               |
| [docs/integration.md](docs/integration.md)                                 | Installing, and what the calling application must do     |
| [docs/maintenance.md](docs/maintenance.md)                                 | Quantum updates, breakage, releases, publication         |
| `schemas/`                                                                 | JSON Schemas for the request, options and result         |
| `examples/`                                                                | A request, its result, and a failure                     |
| `test/vectors/`                                                            | Portable request → payload → records vectors             |

## Develop

```bash
npm install
npm run verify
```

`verify` runs Prettier, the type check, the build and the tests. `npm run format` fixes
formatting. `node --experimental-strip-types scripts/build-vectors.ts` regenerates the vectors and
`examples/result.json`; observed vectors always take their expected payloads from the fixtures,
never from the encoder.

`test/fixtures/` holds codes exported by AB Quantum, published with Applied Ballistics'
agreement. They are evidence; never edit them.

## Trademarks

AB Quantum, Applied Ballistics and Garmin are trademarks of their owners. This project is
independent and is not affiliated with, endorsed by or supported by them. Their names are used only
to say which app's import format the codec targets.

## License

[Apache License 2.0](LICENSE). See [NOTICE](NOTICE).
