# Release guide

How to cut a release of the DPDP accelerator, and what the pipeline does on your behalf.

Releases are built by the **Release builder** workflow
([`.github/workflows/release-builder.yml`](../.github/workflows/release-builder.yml)). It is
dispatched by hand — nothing releases on a push or a merge.

## What a release produces

| | |
|---|---|
| Tag | `vX.Y.Z`, pointing at a `[Release] X.Y.Z` commit |
| Release assets | `wso2-dpdp-is-accelerator-X.Y.Z.zip`, plus the source archives GitHub attaches to every release automatically. GitHub publishes a SHA-256 digest for each asset itself, so no checksum sidecar is uploaded |
| Follow-up | A PR against `dev` raising the reactor to the next `-SNAPSHOT` |

The root `pom.xml` is the single source of truth for the version — there is deliberately no
`version.txt` to drift from it. Every child pom inherits the version through `<parent>` and
declares none of its own, so `mvn versions:set` fans one number out to all 17 poms.

Tags carry a `v` prefix; poms and filenames use bare semver. Maven cannot resolve a
`v`-prefixed version, so the two are never conflated — the pipeline rejects a `version`
input that starts with `v`.

## Before the first release

The **Run workflow** button only appears once `release-builder.yml` is on the default
branch (`main`). Until then there is nothing to dispatch.

## Cutting a release

### 1. Put `main` on the commit you want to ship

The pipeline releases whatever `main` currently points at. It does no merging of its own, so
land `dev` into `main` first.

### 2. Optionally write the highlights

Commit `release-notes/X.Y.Z.md` and its contents become the **What's new** section of the
release body. Leave it out and that section is simply omitted; you still get the
auto-generated changelog of merged PRs.

This is the one part no API can infer, and it is where the narrative belongs — what changed
and why it matters, rather than a list of commit subjects.

### 3. Dispatch a dry run

**Actions → Release builder → Run workflow**, with branch `main`.

| Input | Default | Set it when |
|---|---|---|
| `version` | Root pom version minus `-SNAPSHOT` | Releasing something other than what the pom says |
| `next_version` | Minor bump (`1.0.0` → `1.1.0`) | You want a patch or major bump instead |
| `prerelease` | off | Cutting an RC, **or releasing from any branch other than `main`** |
| `run_e2e` | on | Turn off only to make a dry run quick |
| `dry_run` | off | **On for the first run** |

With `dry_run` on, everything builds and the release notes render, but nothing is committed,
tagged or published. Download the `release-preview` artifact and check `release-body.md`,
the zip. Pairing it with `run_e2e: off` finishes in a few minutes.

### 4. Dispatch the real run

Same inputs, `dry_run` off.

Budget roughly **two hours** with the E2E gate on: it builds Identity Server from
`product-is` master, because the published-release + U2 update path is currently blocked
upstream (the public release zip is missing the `migration-resources/` tree the update tool
needs).

### 5. Merge the version-bump PR

The PR against `dev` arrives **without checks**. GitHub does not run `pull_request` workflows
on a PR opened by `GITHUB_TOKEN`, so the pipeline runs `mvn validate` on the bumped reactor
during the release run instead and says so in the PR body.

## How the pipeline is put together

```
prepare ─┬─ e2e ──┐
         └─ build ─┴─ release ── post-release
```

- **prepare** — resolves and validates the version, rejects an existing tag, and refuses a
  non-prerelease off `main`. Everything downstream reads its outputs rather than
  re-deriving them.
- **e2e** — the same suite that gates a PR, via the reusable
  [`e2e.yml`](../.github/workflows/e2e.yml). Skippable with `run_e2e: off`.
- **build** — `versions:set`, then `mvn clean install`, then asserts the zip exists at the
  exact expected path. That assertion is also what proves `versions:set` reached every
  module.
- **release** — makes the release commit, renders the notes, pushes the tag, publishes.
- **post-release** — opens the next-`-SNAPSHOT` PR against `dev`.

### Why `main` never moves

The release commit is published by pushing **only the tag**. `git push origin refs/tags/vX.Y.Z`
carries the commit's objects with it, so the commit is reachable through the tag without any
branch being written to.

The consequence to be aware of: **`main` stays on `-SNAPSHOT`**. `git checkout vX.Y.Z` gives
exactly the tree that produced the artifact, and `git log main` does not show the release
commit. `main` picks up the new version later, when `dev` merges forward.

This is what keeps the whole pipeline inside `GITHUB_TOKEN`'s reach — it needs no repository
secret, only the `contents: write` and `pull-requests: write` permissions declared in the
workflow. Pushing a release commit to `main` would have needed either an unprotected branch
or an admin-granted bypass.

## If a run fails

Nothing is published until the tag push, which is the second-to-last step of `release`. A
failure in `prepare`, `build` or the E2E gate leaves no tag, no release and no commit — fix
the cause and dispatch again.

Two guards fail fast, before any expensive work:

- an existing tag for the requested version is rejected;
- a non-prerelease dispatched from any branch other than `main` is rejected.

## Rehearsing in a fork

A fork is a reasonable place to exercise the pipeline end to end, with two caveats:

- **`workflow_dispatch` needs the workflow on the fork's default branch** before the Run
  workflow button appears.
- **Releasing from a branch other than `main` requires `prerelease: on`**, or `prepare`
  rejects the run by design.

A fork with no `dev` branch is handled: `post-release` logs a warning and skips rather than
failing a run that has already published successfully. Create a `dev` branch in the fork if
you want to exercise that job too.

The pipeline pins `gh` to the repository it is running in (`GH_REPO`). Without that, `gh`
resolves a fork's base repository to its upstream parent, and a rehearsal run would aim its
version-bump PR at `wso2/dpdp-accelerator`.
