# Integrating the codec

The codec knows nothing about any particular match application. It takes a complete, clean match
and returns codes. Everything about where the match comes from belongs to the caller.

## Installing

The repository is private. Two ways to consume it, both pinned:

- **Git dependency at a tag**, for example `"match-qr-codec": "github:WaitWut/match-qr-codec#v0.1.0"`.
  npm runs the `prepare` script, which builds `dist/`. The installing machine and CI need read
  access to the repository.
- **Vendored snapshot**: copy `dist/` and `schemas/` into the consuming repository with a note of
  the upstream tag and commit. Keep the copy unmodified and replace it on each update.

Never copy the source in without its provenance; an untracked fork loses the format notes and
tests that make it trustworthy.

## The caller's job

1. **Map your data to a request.** Parse your own distance types deliberately: reject empty,
   partial, null or non-positive values with a message the person who prepared the match can act
   on. Do not drop a target to make a request valid.
2. **Decide repeated engagements.** If a target is engaged more than once in a stage, decide how
   it appears. The request is a list of distinct targets in the order you want them.
3. **Surface every failure.** Show `issues` to the person who can fix the match, with the
   offending stage or target identified from `path`. Do not show a partial set of codes.
4. **Choose UUIDs.** Pass them in `options.uuids`. Keep the same UUIDs for the same export if you
   want the screen, print and download to match. See the open questions in
   [api-contract.md](api-contract.md#options).
5. **Choose `maxPayloadBytes`** from your tested print size and error correction level. See
   [rendering.md](rendering.md).
6. **Render and label** every code. Show a rendering failure; don't hide it.

## What not to do

- Do not present any returned text, or anything Quantum shows after import, as your application's
  ballistic output. The codes carry geometry only.
- Do not use AB, Garmin or Quantum marks without AB's written permission.
- Do not claim Quantum support beyond what compatibility.md records as tested.
- Do not ship the feature to end users before the fresh-match, multi-code, unit and print rows in
  compatibility.md have results.
