# CMMS Staging Load Test

Use this only against staging/test data. The script creates records whose ids start with `loadtest-*`, measures the public API, and deletes the generated rows unless `--keep` is passed.

## Commands

```bash
npm run staging:load:test -- --profile=smoke
npm run staging:load:test -- --profile=pilot
npm run staging:load:test -- --profile=tenk
```

Profiles:

- `smoke`: small proof that seed, API timing, and cleanup work.
- `pilot`: first realistic candidate load.
- `tenk`: larger stress pass before production labeling.

Optional overrides:

```bash
npm run staging:load:test -- --profile=pilot --tickets=2000 --tasks=1000 --cleaning-complaints=1000
```

Default thresholds:

- API p95 <= 1000 ms.
- API max <= 3000 ms.
- each seed table <= 120000 ms.
- each cleanup table <= 120000 ms.

The output is JSON with `apiSamples`, `apiSummary`, seed timings, cleanup timings, and remaining generated row counts. A passing cleanup reports zero remaining generated rows.
