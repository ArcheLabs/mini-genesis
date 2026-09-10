import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const streamAbi = JSON.parse(await readFile(resolve(root, "packages/abi/MiniGenesisStream.json"), "utf8"));
const curveAbi = JSON.parse(await readFile(resolve(root, "packages/abi/MiniGenesisCurve.json"), "utf8"));
await writeFile(resolve(root, "packages/web/src/genesis/abi.generated.ts"), `// Generated from packages/abi/MiniGenesisStream.json. Do not edit.\nexport const genesisAbi = ${JSON.stringify(streamAbi, null, 2)} as const;\n`);
await writeFile(resolve(root, "packages/web/src/genesis/curve-abi.generated.ts"), `// Generated from packages/abi/MiniGenesisCurve.json. Do not edit.\nexport const curveAbi = ${JSON.stringify(curveAbi, null, 2)} as const;\n`);
