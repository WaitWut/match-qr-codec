# Quantum import format: what has been observed

Everything here was learned from codes AB Quantum exported. **None of it is an AB-published
specification.** Where AB later confirms or corrects something, record it here with the source and
date, and mark it confirmed.

## Samples

| Sample                     | Codes | Source                                                        | Notes                                                         |
| -------------------------- | ----- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| PFG rimfire match          | 1     | AB Quantum export, appVersion 792, received 2026-10-08        | Six sectors, twelve targets. Group name cut to 20 characters. |
| Large Export Test          | 2     | AB Quantum export, appVersion 792, received 2026-10-14        | Six sectors of six targets. Split inside Sector 6.            |
| `qr import test` (derived) | 1     | The PFG export, renamed and every distance +1, AB's UUID kept | Imported successfully into Quantum, reported 2026-10-09.      |

The images and payload text are in `test/private-fixtures/`. They are private evidence.

## Envelope

Each QR code holds one compact JSON object, keys in this order:

```json
{
  "appName": "Quantum",
  "appVersion": "792",
  "data": "<hex>",
  "dataType": 1,
  "rawValue": "",
  "uuid": "32A13D34F3",
  "versionType": 0
}
```

- `appName`, `appVersion`, `dataType`, `rawValue` and `versionType` were identical in every sample.
  Their meanings are unconfirmed. `appVersion` is not necessarily the version the app displays.
- `uuid` is ten uppercase hex characters (five bytes). The two codes of one export have different
  UUIDs, and no envelope carries a shared export id, part number or part count.
- `data` is lowercase hex of the masked record stream.

## Mask

`mask = uuid bytes XOR d9 ca 21 f3 49`. The five-byte mask repeats over the stream bytes from
offset zero in each code. This holds exactly for all three AB-exported codes. An earlier
assumption of one fixed mask for every export was wrong.

How AB generates UUIDs, and whether the UUID means anything to the importer beyond the mask, is
unknown. The derived sample reused the PFG export's UUID with different content and still
imported, so content is not checked against the UUID.

## Record stream

UTF-8 records, each terminated by `%`, each starting `:QR,` and comma-separated:

```text
:QR,TS,<sector name>,<group name>%
:QR,TD,<index>,0,,<distance>,0,0%
```

| Record | Zero-based field | Observed                                                                                     |
| ------ | ---------------- | -------------------------------------------------------------------------------------------- |
| TS     | 2                | Sector name.                                                                                 |
| TS     | 3                | Group name, repeated in every sector record.                                                 |
| TD     | 2                | Target index within the sector, from 0.                                                      |
| TD     | 5                | Distance as a bare integer. No unit in the record.                                           |
| TD     | 3, 4, 6, 7       | Always `0`, empty, `0`, `0`. Meaning unknown; not azimuth, inclination or speed until shown. |

No escaping of `,` or `%` inside names has been seen. No sample has non-ASCII names, fractional
distances, or a target attribute other than distance set.

## Multiple codes

AB's exporter splits a large export between whole records. The second code of Large Export Test
holds exactly:

```text
:QR,TS,Sector 6,Large Export Test%:QR,TD,5,0,,600,0,0%
```

It repeats the sector record and keeps index 5. The codes are not fragments of one document and
must not be concatenated. Code 1 is 1921 bytes (904 stream bytes) and the next target record would
have added 40; what rule AB's exporter uses to choose that point is unknown. The app showed a
warning that a large export produces multiple codes.

AB generated both codes at error correction L (versions 32 and 9).

## Not yet known

- How Quantum combines multiple codes, and what it does with codes out of order, repeated or
  missing. The AB pair has not been imported here.
- What a bare distance means when the app is set to meters.
- Whether fractional distances, long names, non-ASCII names or duplicate names survive.
- What the four unknown target fields are.
- UUID generation and identity: re-import, update and duplicate behavior.
- Whether other `appVersion` or `versionType` values change the format.
