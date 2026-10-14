# Rendering

The codec returns text. The consumer renders each `text` as one QR code and owns the image,
print layout and labels.

## Settings

- **Byte mode, as the renderer chooses.** The text is ASCII JSON. Segmentation changes the QR
  version but not the decoded bytes.
- **Four-module quiet zone.** No logo in the centre: nobody has permission to use AB's mark, and
  an overlay costs error correction.
- **Error correction and `maxPayloadBytes` are one decision.** A larger payload needs a higher QR
  version, which means smaller modules at a fixed printed size. A higher error correction level
  makes the same payload need a higher version again.

## Size

Every target adds a 20-byte record, which becomes 40 hex characters. The envelope costs 113 bytes,
and each sector record 2 × (9 + stage and group name lengths). A typical eight-stage, six-target
match (`eight-stage-capacity.json`) is 2,481 bytes as one code: too large for M, Q or H at any
version, and version 37 at L.

Measured with qrcode 1.5.4. Module size assumes a 168 CSS px box at 96 px per inch, including the
quiet zone; it is geometry, not a scan result.

| Payload                    | Bytes | L            | M            | Q            | H            |
| -------------------------- | ----- | ------------ | ------------ | ------------ | ------------ |
| Sample Cup (4 targets)     | 365   | v12, 0.61 mm | v15, 0.52 mm | v18, 0.46 mm | v20, 0.42 mm |
| PFG export (12 targets)    | 1015  | v22, 0.39 mm | v25, 0.36 mm | v30, 0.31 mm | v35, 0.27 mm |
| Eight-stage, part 1 of 3   | 999   | v22, 0.39 mm | v25, 0.36 mm | v31, 0.30 mm | v36, 0.26 mm |
| AB two-code export, part 1 | 1921  | v32, 0.29 mm | v37, 0.26 mm | does not fit | does not fit |

AB's exporter used level L for both of its codes.

## Choosing a limit

Choose the smallest code that has scanned reliably in your real conditions, then set
`maxPayloadBytes` to the largest payload that fits it. More codes are a nuisance to scan, but a
code that will not scan is useless. A printed size has to be tested on paper with real phones; a
bigger print helps scanning but adds no capacity.

A limit around 1,000 bytes keeps a full match to three codes at version 22–25 (L or M). Treat that
as a starting point to test, not a recommendation, until compatibility.md has scan results.

## Several codes

- Label each code with its part, for example "Code 2 of 3". `part` and the array length are there
  for that.
- Present codes in `part` order. Whether Quantum needs them in order is untested; the diagnostic
  decoder requires it.
- Offer a download per code, or all of them, named so their order is obvious.
- A screen, print and download built from the same request and options are identical, so they can
  be regenerated at any time rather than stored.
