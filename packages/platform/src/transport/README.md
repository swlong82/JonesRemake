# REPLACE ME — `transport`

- **Contract:** `index.ts` exports the interface (see `docs/ROADMAP_SCAFFOLDS.md` §16.1, §16.4).
- **v1 default:** LocalTransport (in-process command bus).
- **Replace by:** WsTransport / provider SDK adapter.
- **Contract guard:** `contract.test.ts` — ordering, idempotent seq, reconnect replay. Any new implementation must pass the same suite; add it to the
  `implementations` list at the top of the test and run `pnpm test`.

Steps: (1) implement the interface in a new file here or in a provider package, (2) register it in
`createLocalServices()` or a new `create<Provider>Services()` in `../index.ts`, (3) run the contract
test against it, (4) record an ADR in `DECISIONS.md`.
