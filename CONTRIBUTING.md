# Contributing

Thanks for helping improve `netix-copilot`.

## Getting started

```bash
pnpm install
pnpm build
pnpm test
```

## Before opening a pull request

- `pnpm lint`, `pnpm format:check`, `pnpm test` and `pnpm build` must all pass.
- Rebuild and commit `dist/`. It is checked into the repository so `github:` consumers need no
  build step, and CI fails when the committed output is stale.
- Add tests. Both consuming applications count SDK code toward their own coverage gates, so weak
  tests here become CI failures in every host repository.
- Single-line comments only. Longer rationale belongs in the commit message or the pull request
  body.

## Lockfile and the release-age policy

CI runs pnpm 11.8.0, which enforces a 24 hour `minimumReleaseAge` on every lockfile entry. Some
developer machines in this fleet have that setting relaxed to `0`, and a lockfile resolved on one
of them can pin a package published hours ago that CI then rejects with
`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`.

Resolve under the same policy CI uses:

```bash
rm -f pnpm-lock.yaml
pnpm install --config.minimumReleaseAge=1440
```

## Style

- TypeScript strict, ESLint and Prettier as configured in this repository.
- No runtime dependencies. React and React DOM are peers; everything else is a devDependency.
- Nothing application-specific belongs in this package. If it differs between viz-ui and
  cafm-v2-ui, it goes through an adapter.

## Releasing

See the release section of the [README](README.md#releasing). Tags must be lightweight.
