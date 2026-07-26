#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output="${repo_root}/packages/abi/MiniGenesisStream.json"
temporary="${output}.tmp"

cd "${repo_root}"
forge inspect MiniGenesisStream abi | jq --sort-keys . > "${temporary}"
mv "${temporary}" "${output}"
