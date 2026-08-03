import { ENVIRONMENTS, readManifest } from "./deployment-manifest.mjs";
for (const environment of ENVIRONMENTS) await readManifest(environment);
console.log("Deployment manifests valid: local, staging, production");
