/* eslint-disable @typescript-eslint/no-require-imports -- Local-only staging entry point. */
require("./register-typescript.cjs");
const { readSnapshot } = require("../src/lib/menu/acquisition/snapshot-reader.ts");
const { normalizeSnapshot } = require("../src/lib/menu/acquisition/normalize.ts");
async function main() {
  const args=process.argv.slice(2);
  if (args.length !== 2) {
    console.error("Usage: node scripts/stage-menu-snapshot.cjs <allowed-local-root> <relative-manifest.json>");
    process.exitCode=1;
    return;
  }
  const result=normalizeSnapshot(await readSnapshot({allowedRoot:args[0],manifestPath:args[1]}));
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
  process.exitCode=result.status === "staged" ? 0 : result.status === "quarantined" ? 2 : 1;
}
main().catch(()=>{
  console.error("Local staging failed");
  process.exitCode=1;
});
