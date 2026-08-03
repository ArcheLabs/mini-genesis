# MINI Genesis + Mini Lucky simplified architecture

This document is the repository-tracked M0 architecture baseline. It records the
authoritative local specification without committing `.agent/` inputs.

Read this document together with the Mini Lucky protocol baseline at
`../../mini-lucky/docs/CONTEXT_ALIAS_CREDIT_ARCHITECTURE.md`: this document owns
environment, standalone Genesis wallet and milestone policy; that document owns
the alias protocol model.

- MINI Genesis is a standalone EVM dApp. It uses an EIP-1193 browser wallet, H160
  contributor accounts, EIP-712 claim authorization, and 18 native EVM decimals.
- Mini Lucky is a Product Host application. Trust, balances, and Packets are keyed
  by Personhood context aliases; it is not a Genesis wallet surface.
- The final Genesis ledger and repeatable-claim backend are implemented in later
  milestones. This M0 baseline introduces no contract write path.
- legacy local DotNS publication, CDM, and automatic Bulletin authorization are not part of
  this architecture. Staging and production publication require explicit external
  authorization.

Gate A requires a PVM compile artifact, a read from the Personhood precompile, and
one real Host write-capability observation before Devnet acceptance. Gate B requires
one real user whose finalized People username owner and Product Account resolve to
the same Personhood alias. Neither gate is satisfied by local mocks.
