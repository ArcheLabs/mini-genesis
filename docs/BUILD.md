# Reproducible build

The locally verified toolchain is:

- Foundry `v0.3.0` (`forge 0.3.0`, build `5a8bd89`);
- Solidity `0.8.24`;
- OpenZeppelin Contracts `v5.0.2`, commit
  `dbb6104ce834628e473d2173bbc9d47f81a9eec3`;
- forge-std `v1.9.4`, commit
  `1eea5bae12ae557d589f9f0f0edae2faa47cb262`;
- Slither `0.10.4`;
- optimizer enabled with 10,000 runs and Paris EVM output.

CI pins action revisions and requests Foundry `v0.3.0`; dependencies are pinned Git
submodules. Install the same Foundry release and Slither version, initialize
submodules, then run:

```bash
make check
FOUNDRY_PROFILE=ci forge test
```

`make abi-check` regenerates the ABI and fails on drift. Build metadata and bytecode
hashes must be recorded in the mainnet checklist for the exact source commit.
