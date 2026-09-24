# REPLACE ME — `artpacks`

- **Contract:** `index.ts` exports `ArtPackStore` (see `docs/ART_SPEC.md` §17.6 and `docs/ROADMAP_SCAFFOLDS.md` §16.1).
- **v1 default:** `IndexedDbArtPackStore` — user art packs stay on the device (database `art-packs`); `MemoryArtPackStore` for tests.
- **Replace by:** a synced store (for example per-account cloud storage) once accounts exist. Imports must still be sanitized and validated on the device before they are stored or shared.
- **Contract guard:** `contract.test.ts` — list order, replace by id, delete, copy semantics. Any new implementation must pass the same suite; add it to the `implementations` list at the top of the test and run `pnpm test`.

Steps: (1) implement the interface in a new file here or in a provider package, (2) register it in
`createLocalServices()` or a new `create<Provider>Services()` in `../index.ts`, (3) run the contract
test against it, (4) record an ADR in `DECISIONS.md`.
