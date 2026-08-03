import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const abi = JSON.parse(await readFile(resolve(root, "packages/abi/MiniGenesisStream.json"), "utf8"));
await writeFile(resolve(root, "packages/web/src/genesis/abi.generated.ts"), `// Generated from packages/abi/MiniGenesisStream.json. Do not edit.\nexport const genesisAbi = ${JSON.stringify(abi, null, 2)} as const;\n`);
