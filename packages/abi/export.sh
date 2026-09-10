#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
forge_bin="${FORGE_BIN:-forge}"
outputs=(
  "MiniGenesisStream"
  "MiniGenesisCurve"
)

cd "${repo_root}"
for contract in "${outputs[@]}"; do
  output="${repo_root}/packages/abi/${contract}.json"
  temporary="${output}.tmp"
  "${forge_bin}" inspect "${contract}" abi \
    | jq -c --sort-keys 'sort_by(if .type == "constructor" then 0 elif .type == "error" then 1 elif .type == "event" then 2 else 3 end, .name // "")' \
    | tr -d '\n' > "${temporary}"
  mv "${temporary}" "${output}"
done
