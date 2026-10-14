# Compatibility

What has been tested, how, and what has not. Update this table every time a result comes in. An
untested row stays marked untested; a passing automated check is not an app result.

## Automated (every `npm test`)

| Check                                                                                 | Result |
| ------------------------------------------------------------------------------------- | ------ |
| Encoder reproduces AB's two-code export byte for byte, including the split point      | Pass   |
| Encoder reproduces AB's single-code export byte for byte                              | Pass   |
| Encoder reproduces the derived code that imported successfully                        | Pass   |
| AB's images decode (jsQR) to the stored payload text                                  | 3 of 4 |
| Every vector renders with qrcode 1.5.4 at each level that fits and reads back exactly | Pass   |
| 400 generated matches at generated limits: every code fits, round trip is exact       | Pass   |
| Validation agrees with the JSON Schema on structural cases                            | Pass   |

jsQR cannot read AB's original single-code PNG, which ZXing reads. That image's payload is pinned
to the SHA-256 recorded by the ZXing analysis. QR readers differ, and phone cameras differ more, so
a code one reader accepts is not proof another will.

## Quantum app

| Date       | Code                                                                            | App / platform                | Route        | Result                                                                           |
| ---------- | ------------------------------------------------------------------------------- | ----------------------------- | ------------ | -------------------------------------------------------------------------------- |
| 2026-10-09 | Derived PFG code (`import-test.json`)                                           | Not recorded                  | Not recorded | Imported: renamed group, six sectors, all distances +1. Reported by Eric Wilson. |
| 2026-10-14 | AB's two codes (`ab-large-export.json`), in order                               | Android, version not recorded | Not recorded | Imported. Reported by Eric Wilson.                                               |
| 2026-10-14 | `sample-cup.json`, built by this codec                                          | Android, version not recorded | Not recorded | Imported. Reported by Eric Wilson.                                               |
| 2026-10-14 | `eight-stage-capacity.json`, three codes split at this codec's points, in order | Android, version not recorded | Not recorded | Imported. Reported by Eric Wilson.                                               |

The 2026-10-14 codes were rendered by `scripts/render-app-test-codes.ts` (qrcode 1.5.4, level L,
1000 px) and scanned from a screen. Per-sector detail was not recorded beyond "worked". Scan order
other than in order, iOS, and paper are untested.

## Still to test

From the validation plan. Record app version as displayed, OS, unit setting, route (camera or saved
image), expected, actual, and evidence.

| Test                                             | Establishes                                         |
| ------------------------------------------------ | --------------------------------------------------- |
| Multi-code exports scanned in reverse order      | Whether order matters; partial state after one code |
| Everything above on iOS                          | Platform parity                                     |
| One code of a multi-code export omitted          | Whether a missing code is detected                  |
| Same code imported twice; same group, one change | Duplicate and update behavior; UUID role            |
| Known-yard code with the app in meters           | Unit interpretation                                 |
| 52.5 yd (requires lifting the precision rule)    | Fractional distances                                |
| Long, duplicate and non-ASCII names              | Name limits and escaping                            |
| Printed codes at the consumer's real size, L/M/H | Scan reliability on paper                           |
| Downloaded image imported on the same phone      | Saved-image route                                   |

Run each supported scenario on both iOS and Android before claiming both.
