#!/usr/bin/env sh
# Moves every milestone tag onto the first `main` commit that contains its gate (ADR-0038).
# The build session cannot push tags (KI-001), so the owner runs this once from a clone with
# push rights. m6 and m7 already exist on the remote at branch commits that squash merges left
# out of `main`; they are replaced, which is why this uses --force.
set -eu
git fetch origin main --tags
while read -r tag sha; do
  git merge-base --is-ancestor "$sha" origin/main || { echo "$sha is not on origin/main" >&2; exit 1; }
  git tag -f -a "$tag" "$sha" -m "$tag gate (first main commit containing it; ADR-0038)"
done <<'MAP'
m1 1726af3
m2 1726af3
m3 a76efb2
m4 b4c979d
m5 a76efb2
m6 f8afb46
m7 f8afb46
m8 03caf07
v1.0.0 03caf07
MAP
git push --force origin m1 m2 m3 m4 m5 m6 m7 m8 v1.0.0
