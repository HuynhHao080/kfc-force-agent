# S1.2 — Menu Data Contract Foundation

## Scope and baseline

S1.1 was reviewed from the conversation and rechecked against commit
`a1cfeb4c093b532a48eada804031778f1b5ff55b` on `main` (clean tree).
`types/menu.ts`, the menu repository interface/implementations, menu validation,
the TypeScript test loader and `docs/menu-domain.md` still describe a demo seed.
There is no raw official menu snapshot in this checkout. The option map key
mismatch and unsupported cart options observed in S1.1 remain outside S1.2.

This is an additive, offline interchange contract. It does not replace the
existing MenuItem/ProductBundle types, change repository/API behavior, import
fixtures into the application, migrate storage, or modify orders. No crawler,
inference call, live menu verification or production migration is included.

## Version 1

The runtime validator is `menuDatasetSchema` in
`src/lib/validation/menu-data.ts`; `src/lib/types/menu-data.ts` exports inferred
types. Inputs are strict JSON objects: no coercion, inferred defaults or silent
removal of unknown fields. Validation failures use Zod issue paths.

The dataset has `schemaVersion: 1`, stable `datasetId`, `datasetVersion`,
`classification`, `updatedAt`, and explicit arrays of `provenance`, `products`,
`combos`, `comboItems`, `variants`, `options` and `optionValues`.

- Product: standalone sellable item with ID, Vietnamese name, price and
  availability. IDs are unique within each entity collection; references are
  typed by collection. Product and combo IDs also cannot overlap.
- Combo: separately priced offer; its price is never calculated by adding its
  component prices. `compositionStatus` is `known` or `unknown`.
- ComboItem: a product reference, optional variant reference and positive
  integer quantity. V1 supports fixed compositions only, without nested combos,
  substitutions or choice groups. Unknown composition has no asserted rows and
  requires a reason; known composition must contain at least one row.
- Variant: belongs to a product, with explicit attributes, price and
  availability. There is no implicit inheritance of price or availability.
- Option: belongs to a product and optionally one of that product's variants;
  `minSelections` and `maxSelections` express whether selection is required.
- OptionValue: belongs to an option, has an explicit price delta and
  availability. V1 deltas are nonnegative VND surcharges; discounts and pricing
  execution are outside scope. Unknown deltas are representable.

Every catalog entity has `createdAt`, `updatedAt`, and `provenanceId`.
References, selection bounds, duplicate component/variant combinations and
parent ownership are validated across the full dataset. An option must have
enough declared values for its selection bounds; availability is not inferred
from those values.

## Price, availability and evidence

Price is either `known` (safe integer VND amount >= 0 plus provenance ID), or
`unknown` (null amount/provenance and a nonempty reason). Zero is a known price,
not a substitute for missing data. Base prices, combo prices, variant prices and
option deltas all use this explicit representation. No numeric strings, floats,
negative amounts, NaN or Infinity are accepted.

Availability is `available`, `unavailable` or `unknown`. Known declarations
require provenance and, except demo seed declarations, an observation time.
Unknown status requires a reason and null evidence/time. `scope` is required
text describing where the assertion applies, including when scope is unknown.
Availability never becomes a live stock guarantee or an inferred boolean.

Provenance records use `sourceKind` (`seed_demo`, `manual`, `kfc_official`),
`sourceUrl` (HTTPS or null), `sourceRef` (artifact locator), `rawSha256` (SHA256 or
null), `observedAt`, `sourceUpdatedAt`, `verificationStatus`, `verifiedAt`,
`verifiedBy`, and `reason`. Seed timestamps are declarations, not observations.
Seed sources cannot be marked verified. A verified source requires a URL,
artifact hash, observation time, verification time and reviewer identity.
Unverified records require a reason and cannot retain verification credentials.

Dataset classification:

- `seed_demo`: all sources are unverified demo seed records.
- `unverified`: accepts explicitly unverified/mixed material without promotion.
- `kfc_verified`: every source must be declared `kfc_official` and verified.

The validator checks evidence structure, not the truth of a URL, raw hash,
reviewer's identity or official-source assertion. A future trusted ingestion /
human review boundary must authenticate these before accepting externally
supplied `kfc_verified` records. Neither fixture loading nor validation verifies
KFC data. There is intentionally no real verified-KFC fixture in this change.

`rawSha256` is the hash of the artifact identified by `sourceRef`; any newline or
encoding normalization must be explicit there. This validator has no access to
that artifact and therefore only checks the hash format. The demo fixture test
additionally checks its source hash and compares its facts to the actual seed.

Times are ISO8601 UTC values. Entity creation <= entity update <= dataset update;
source update <= observation <= verification <= dataset update when present.
Availability observations must also fit the entity update and source observation.
Validation compares recorded times, not the machine clock; replaying a historic
snapshot is deterministic. Freshness/expiry policy is a later integration task.

## Fixture and tests

`tests/fixtures/menu/demo-v1.json` is a small transcription of existing demo
seed declarations: burger, fries, Pepsi, family combo, a Pepsi 1.5L variant and
burger spice choices. Its raw source hash records the seed file after LF newline
normalization, noted in `sourceRef`. It has no official URL or verification.
The fixture is independent of the repository's broken option-map indexing.
The variant represents the already named Pepsi 1.5L item; no alternative price
or volume is invented. Unknown-data examples and deliberately fictional
verification metadata are created only in tests.

Run `npm run test:menu`. Tests use the existing in-memory TypeScript loader,
read local fixtures and emit results to stdout; no network, persistence writes
or source promotion. `npm run check` includes this suite.

Test-first evidence: the initial fixture/tests failed because the contract module
did not exist. A subsequent malformed-URL regression failed with `Invalid URL`
before the URL parsing guard was added. The completed suite has 87 cases covering
valid/unknown data, typed references, invalid prices, provenance and chronology.
The existing chat prompt comparison now normalizes CRLF/LF on both sides; only
line endings are ignored, while prompt content and the allowlist remain checked.
No prompt or application behavior was changed by that portability fix.

Validation on 2026-11-09 (Node 24.13.0, Next.js 16.4.5, Windows):
`npm run check` exited 0: lint, typecheck, 87 menu contract cases, 89 chat
regression groups, 9 synthetic backup/recovery groups, production build and 73
HTTP integration groups all passed. The initial sandbox run stopped at
`spawnSync EPERM`; the complete run passed with permission to spawn local test
processes. Cloud adapters used fake transports; local persistence tests used
temporary synthetic stores. No AWS/KFC API or paid inference was invoked.

S1.2 verdict: PASS for the offline contract foundation. This is not acceptance
of official KFC menu data or production ingestion. No commit/push was performed.

## Compatibility and follow-up

Legacy types remain unchanged. Importers/adapters are deliberately absent:
legacy numeric prices and availability booleans cannot safely represent unknown
states, and current cart code cannot execute variants/options/bundles. A future
adapter needs an explicit handling policy, trusted verification boundary,
freshness/store scope rules and regression tests before repository integration.
S1.2 does not repair the legacy seed map or claim existing runtime data conforms
to this new contract. NLP changes are also outside this stage.
